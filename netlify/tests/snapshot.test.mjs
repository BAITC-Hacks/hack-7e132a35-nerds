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
 const snapshot={format:'akim-postgres-v1',tables:{
   users:[{id:'11000000-0000-4000-8000-000000000001',login:'snapshot.test',display_name:'Synthetic test',password_hash:'test-fixture-not-a-real-password-hash',role:'participant',disabled:false,created_at:'2026-01-01T00:00:00.000Z'}],
   sessions:[{token_hash:'a'.repeat(64),user_id:'11000000-0000-4000-8000-000000000001',created_at:'2026-01-01T00:00:00.000Z',expires_at:'2026-01-02T00:00:00.000Z'}],
   auth_limits:[{key:'synthetic-test',attempts:2,expires_at:'2026-01-02T00:00:00.000Z'}]
 }};
 await restore(db,snapshot);
 for(const table of tables){const rows=(await db.query(`SELECT * FROM ${table}`)).rows;assert.deepEqual(JSON.parse(JSON.stringify(rows)),snapshot.tables[table]);}
 console.log('PASS: PostgreSQL snapshot restored and every row verified in an isolated schema.');
}finally{await db.query('ROLLBACK');await db.end();}
