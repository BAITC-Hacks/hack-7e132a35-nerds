import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {getDatabase} from '../lib/db.mjs';
import {createAuth,digest,verifyPassword,AuthError} from '../lib/auth.mjs';
import {assertOrigin,body,sessionCookie,tokenFrom} from '../lib/http.mjs';
const db=await getDatabase(),schema='auth_test_'+randomBytes(6).toString('hex');
let passed=0;
const check=async(name,fn)=>{await fn();console.log('PASS '+name);passed++;};
// A separate single-connection pool keeps the test search_path isolated.
const {Client}=await import('pg');const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
const testDb={query:(s,p)=>client.query(s,p),transaction:async fn=>{await client.query('BEGIN');try{const v=await fn(client);await client.query('COMMIT');return v;}catch(e){await client.query('ROLLBACK');throw e;}}};
try{
  await client.query('CREATE SCHEMA '+schema);await client.query('SET search_path TO '+schema);
  await client.query(await fs.readFile(new URL('../db/001_auth.sql',import.meta.url),'utf8'));
  const auth=createAuth(testDb),input={login:'City.Test',password:'Long test password 9382!',name:'Тестовый пользователь',role:'admin'};
  let registered,session;
  await check('Registration normalizes login and cannot elevate role',async()=>{registered=await auth.register(input);assert.equal(registered.login,'city.test');assert.equal(registered.role,'participant');});
  await check('Passwords are hashed and verified',async()=>{const row=(await client.query('SELECT password_hash FROM users WHERE id=$1',[registered.id])).rows[0];assert.notEqual(row.password_hash,input.password);assert.ok(await verifyPassword(input.password,row.password_hash));assert.equal(await verifyPassword('incorrect',row.password_hash),false);});
  await check('Duplicate and malformed accounts rejected',async()=>{await assert.rejects(auth.register(input),e=>e.status===409);await assert.rejects(auth.register({...input,login:"' OR 1=1--"}),e=>e.status===400);await assert.rejects(auth.register({...input,login:'short.pass',password:'short'}),e=>e.status===400);});
  await check('Wrong password and missing account produce same error',async()=>{for(const login of ['city.test','missing.user'])await assert.rejects(auth.login({login,password:'wrong'}),e=>e.status===401&&e.message==='Неверный логин или пароль.');});
  await check('Login produces opaque token, database stores only digest',async()=>{session=await auth.login(input);assert.equal(session.token.length,64);assert.equal((await client.query('SELECT token_hash FROM sessions')).rows[0].token_hash,digest(session.token));assert.equal((await auth.me(session.token)).id,registered.id);assert.equal(await auth.me('forged'),null);});
  await check('Permissions are enforced on the server',async()=>{await assert.rejects(auth.requireUser(session.token,['admin']),e=>e.status===403);await assert.rejects(auth.requireUser(null),e=>e.status===401);});
  await check('Session rotation revokes previous token',async()=>{const old=session.token;session=await auth.login(input,old);assert.equal(await auth.me(old),null);assert.ok(await auth.me(session.token));});
  await check('Disabled user and expired session lose access',async()=>{await client.query('UPDATE users SET disabled=true WHERE id=$1',[registered.id]);assert.equal(await auth.me(session.token),null);await client.query('UPDATE users SET disabled=false WHERE id=$1',[registered.id]);await client.query("UPDATE sessions SET expires_at=CURRENT_TIMESTAMP-interval '1 second'");assert.equal(await auth.me(session.token),null);});
  await check('Logout invalidates session',async()=>{session=await auth.login(input);await auth.logout(session.token);assert.equal(await auth.me(session.token),null);});
  await check('Repeated bad passwords are rate limited',async()=>{for(let i=0;i<10;i++)await assert.rejects(auth.login({...input,password:'bad'}),e=>e.status===401);await assert.rejects(auth.login(input),e=>e.status===429);});
  await check('Cross-origin requests rejected, same-origin accepted',async()=>{const origin=process.env.APP_ORIGIN;assert.throws(()=>assertOrigin(new Request(origin,{headers:{Origin:'https://evil.example'}})),e=>e.status===403);assertOrigin(new Request(origin,{headers:{Origin:origin}}));});
  await check('Cookie attributes and body size limit',async()=>{const c=sessionCookie('a'.repeat(64),new Date());assert.ok(c.includes('HttpOnly'));assert.ok(c.includes('SameSite=Strict'));assert.equal(tokenFrom(new Request('http://localhost',{headers:{cookie:'akim_session=abc'}})),'abc');await assert.rejects(body(new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(5000)})),e=>e.status===413);});
  console.log(passed+' authentication checks passed against PostgreSQL.');
}finally{await client.query('SET search_path TO public');await client.query('DROP SCHEMA '+schema+' CASCADE');await client.end();await db.close();}
