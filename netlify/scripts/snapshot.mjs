import fs from 'node:fs/promises';
import path from 'node:path';
import {Client} from 'pg';
export const tables=['users','sessions','auth_limits'];
export async function restore(client,snapshot){
  if(snapshot.format!=='akim-postgres-v1'||tables.some(t=>!Array.isArray(snapshot.tables?.[t])))throw Error('Invalid snapshot');
  const columns={users:['id','login','display_name','password_hash','role','disabled','created_at'],sessions:['token_hash','user_id','created_at','expires_at'],auth_limits:['key','attempts','expires_at']};
  for(const table of tables)for(const row of snapshot.tables[table]){
    const keys=columns[table];
    await client.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>row[k]));
  }
}
export async function exportSnapshot(){
  const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
  try{
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const actual=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
    if(actual.join(',')!==[...tables].sort().join(','))throw Error('Database schema changed; update exporter before making a complete snapshot');
    const data={};for(const table of tables)data[table]=(await client.query(`SELECT * FROM ${table}`)).rows;
    const snapshot={format:'akim-postgres-v1',createdAt:new Date().toISOString(),tables:data};
    await client.query('COMMIT');
    const dir=path.resolve(import.meta.dirname,'../backup');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'database.json'),JSON.stringify(snapshot,null,2),{mode:0o600});
    console.log('Consistent PostgreSQL snapshot created:',Object.fromEntries(tables.map(t=>[t,data[t].length])));
  }catch(e){await client.query('ROLLBACK');throw e;}finally{await client.end();}
}
