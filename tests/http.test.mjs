import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Client} from 'pg';
const origin=process.env.APP_ORIGIN,login='http_test_'+randomBytes(5).toString('hex'),password=randomBytes(20).toString('base64url');
const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();
const post=(path,data,cookie='',requestOrigin=origin)=>fetch(origin+path,{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)});
try{
  assert.equal((await fetch(origin+'/api/me')).status,401);
  assert.equal((await fetch(origin+'/simulator')).status,401);
  assert.equal((await fetch(origin+'/simulator/app.js')).status,401);
  assert.equal((await post('/api/auth/login',{login,password},'','https://other.example')).status,403);
  const created=await post('/api/auth/register',{login,password,name:'HTTP test',role:'admin'});assert.equal(created.status,201);assert.equal((await created.json()).user.role,'participant');
  const wrong=await post('/api/auth/login',{login,password:'incorrect'});assert.equal(wrong.status,401);
  const response=await post('/api/auth/login',{login,password});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('SameSite=Strict'));const session=cookie.split(';')[0];
  const me=await fetch(origin+'/api/me',{headers:{Cookie:session}});assert.equal(me.status,200);assert.equal((await me.json()).user.login,login);
  assert.equal((await fetch(origin+'/simulator',{headers:{Cookie:session}})).status,200);
  assert.equal((await fetch(origin+'/simulator/app.js',{headers:{Cookie:session}})).status,200);
  assert.equal((await post('/api/auth/logout',{},session)).status,200);
  assert.equal((await fetch(origin+'/api/me',{headers:{Cookie:session}})).status,401);
  console.log('HTTP checks passed: protected routes, registration, login, cookie, role, CSRF and logout.');
}finally{await db.query('DELETE FROM users WHERE login=$1',[login]);await db.end();}
