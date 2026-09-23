import fs from 'node:fs/promises';
import {Client} from 'pg';
const secrets=JSON.parse(await fs.readFile(new URL('../.local-postgres/bootstrap.json',import.meta.url),'utf8'));
const db=new Client({host:'127.0.0.1',port:54329,user:'postgres',database:'postgres',password:secrets.adminPassword});
await db.connect();
try{
  // The password is generated internally as hexadecimal; never accept SQL here from user input.
  if(!/^[a-f0-9]{48}$/.test(secrets.appPassword))throw Error('Invalid generated password');
  if(!(await db.query("SELECT 1 FROM pg_roles WHERE rolname='akim_app'")).rowCount)await db.query(`CREATE ROLE akim_app LOGIN PASSWORD '${secrets.appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
  if(!(await db.query("SELECT 1 FROM pg_database WHERE datname='akim'")).rowCount)await db.query('CREATE DATABASE akim OWNER akim_app');
  console.log('PostgreSQL database akim and restricted application role are ready.');
}finally{await db.end();}
