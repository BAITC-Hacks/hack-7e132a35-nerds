import {randomUUID} from 'node:crypto';
import {getDatabase} from '../lib/db.mjs';
import {hashPassword,normalizeLogin} from '../lib/auth.mjs';
const login=normalizeLogin(process.env.NEW_USER_LOGIN),password=process.env.NEW_USER_PASSWORD,name=process.env.NEW_USER_NAME||login,role=process.env.NEW_USER_ROLE||'participant';
if(!['participant','admin'].includes(role))throw Error('NEW_USER_ROLE must be participant or admin');
if(name.length>80)throw Error('Name too long');
const hash=await hashPassword(password),db=await getDatabase();
try{await db.query('INSERT INTO users(id,login,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5)',[randomUUID(),login,name,hash,role]);console.log('User created:',login,'role:',role);}finally{await db.close();}
