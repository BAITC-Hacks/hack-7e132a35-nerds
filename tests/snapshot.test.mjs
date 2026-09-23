import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {Client} from 'pg';
import {restore,tables} from '../scripts/snapshot.mjs';
const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();
const schema='snapshot_test_'+randomBytes(6).toString('hex');
try{
 await db.query('BEGIN');await db.query('CREATE SCHEMA '+schema);await db.query('SET LOCAL search_path TO '+schema);
 await db.query(await fs.readFile(new URL('../db/001_auth.sql',import.meta.url),'utf8'));
 const snapshot=JSON.parse(await fs.readFile(new URL('../backup/database.json',import.meta.url),'utf8'));
 await restore(db,snapshot);
 for(const table of tables){const rows=(await db.query(`SELECT * FROM ${table}`)).rows;assert.deepEqual(JSON.parse(JSON.stringify(rows)),snapshot.tables[table]);}
 console.log('PASS: PostgreSQL snapshot restored and every row verified in an isolated schema.');
}finally{await db.query('ROLLBACK');await db.end();}
