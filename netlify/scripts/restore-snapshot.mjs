import fs from 'node:fs/promises';
import {Client} from 'pg';
import {restore,tables} from './snapshot.mjs';
const file=new URL('../backup/database.json',import.meta.url);
let raw;try{raw=await fs.readFile(file,'utf8');}catch(e){if(e.code==='ENOENT'&&process.argv.includes('--if-empty')){console.log('No snapshot; fresh database.');process.exit(0);}throw e;}
const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();
try{
 await db.query('BEGIN');
 await db.query('LOCK TABLE users, sessions, auth_limits IN ACCESS EXCLUSIVE MODE');
 let count=0;for(const table of tables)count+=Number((await db.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
 if(count){if(!process.argv.includes('--if-empty'))throw Error('Database is not empty. Refusing to overwrite local data.');console.log('Existing database preserved; snapshot not applied.');}
 else{await restore(db,JSON.parse(raw));console.log('Snapshot restored into PostgreSQL.');}
 await db.query('COMMIT');
}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
