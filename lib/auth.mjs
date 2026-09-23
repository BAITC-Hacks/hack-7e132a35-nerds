import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback), options={N:32768,r:8,p:3,maxmem:64*1024*1024};
export const COOKIE='akim_session';
export class AuthError extends Error {constructor(status,message){super(message);this.status=status;}}
export function normalizeLogin(value){if(typeof value!=='string')throw new AuthError(400,'Введите логин.');const login=value.trim().toLowerCase();if(!/^[a-z0-9_.-]{3,40}$/.test(login))throw new AuthError(400,'Логин: 3–40 латинских букв, цифр, точек, дефисов или подчёркиваний.');return login;}
export function validatePassword(password){if(typeof password!=='string'||password.length<12||password.length>128)throw new AuthError(400,'Пароль должен содержать от 12 до 128 символов.');}
export async function hashPassword(password){validatePassword(password);const salt=randomBytes(16).toString('hex'),key=await scrypt(password,salt,64,options);return 'scrypt-v1$'+salt+'$'+key.toString('hex');}
export async function verifyPassword(password,hash){if(typeof password!=='string'||password.length>128)return false;const [version,salt,stored]=String(hash).split('$');if(version!=='scrypt-v1'||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(stored))return false;const actual=await scrypt(password,salt,64,options);return timingSafeEqual(actual,Buffer.from(stored,'hex'));}
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const publicUser=row=>({id:row.id,login:row.login,name:row.display_name,role:row.role});
const dummyHash='scrypt-v1$0123456789abcdef0123456789abcdef$'+'0'.repeat(128);
export async function consumeLimit(db,key,max=10){
  const result=await db.query(`INSERT INTO auth_limits(key,attempts,expires_at) VALUES($1,1,CURRENT_TIMESTAMP + interval '15 minutes')
    ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_limits.expires_at<=CURRENT_TIMESTAMP THEN 1 ELSE auth_limits.attempts+1 END,
    expires_at=CASE WHEN auth_limits.expires_at<=CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + interval '15 minutes' ELSE auth_limits.expires_at END RETURNING attempts`,[key]);
  if(result.rows[0].attempts>max)throw new AuthError(429,'Слишком много попыток. Повторите через 15 минут.');
}
export function createAuth(db,{sessionHours=12}={}){
  const hours=Number(sessionHours);if(!Number.isFinite(hours)||hours<1||hours>168)throw Error('SESSION_HOURS must be 1–168');
  async function createSession(user,oldToken){const token=randomBytes(32).toString('hex'),expires=new Date(Date.now()+hours*3600000);await db.transaction(async tx=>{
    if(oldToken)await tx.query('DELETE FROM sessions WHERE token_hash=$1',[digest(oldToken)]);
    await tx.query('DELETE FROM sessions WHERE expires_at<=CURRENT_TIMESTAMP');
    await tx.query('DELETE FROM auth_limits WHERE expires_at<=CURRENT_TIMESTAMP');
    await tx.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[digest(token),user.id,expires.toISOString()]);
  });return {token,expires,user:publicUser(user)};}
  return {
    async register(input){
      await consumeLimit(db,'register-global',30);
      const login=normalizeLogin(input.login);validatePassword(input.password);
      const name=typeof input.name==='string'?input.name.trim():'';
      if(!name||name.length>80)throw new AuthError(400,'Имя должно содержать от 1 до 80 символов.');
      const passwordHash=await hashPassword(input.password);
      try{const result=await db.query('INSERT INTO users(id,login,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id,login,display_name,role',[randomUUID(),login,name,passwordHash,'participant']);return publicUser(result.rows[0]);}catch(error){if(error.code==='23505')throw new AuthError(409,'Этот логин уже занят. Выберите другой.');throw error;}
    },
    async login(input,oldToken){
      await consumeLimit(db,'login-global',300);
      const login=normalizeLogin(input.login);
      await consumeLimit(db,'login-'+digest(login),10);
      if(typeof input.password!=='string'||input.password.length>128)throw new AuthError(401,'Неверный логин или пароль.');
      const result=await db.query('SELECT * FROM users WHERE login=$1',[login]),user=result.rows[0];
      const correct=await verifyPassword(input.password,user?.password_hash||dummyHash);
      if(!user||!correct||user.disabled)throw new AuthError(401,'Неверный логин или пароль.');
      await db.query('DELETE FROM auth_limits WHERE key=$1',['login-'+digest(login)]);
      return createSession(user,oldToken);
    },
    async me(token){if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;const result=await db.query(`SELECT u.id,u.login,u.display_name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>CURRENT_TIMESTAMP AND u.disabled=false`,[digest(token)]);return result.rows[0]?publicUser(result.rows[0]):null;},
    async logout(token){if(token)await db.query('DELETE FROM sessions WHERE token_hash=$1',[digest(token)]);},
    async requireUser(token,roles){const user=await this.me(token);if(!user)throw new AuthError(401,'Войдите в аккаунт.');if(roles&&!roles.includes(user.role))throw new AuthError(403,'Недостаточно прав.');return user;}
  };
}
