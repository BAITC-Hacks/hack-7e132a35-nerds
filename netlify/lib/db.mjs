let pending;
export async function getDatabase() {
  if (!pending) pending = createDatabase().catch(error=>{pending=null;throw error;});
  return pending;
}
async function createDatabase() {
  if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
  const {Pool}=await import('pg');
  const requestedMax=Number(process.env.PG_POOL_MAX ?? 1);
  const max=Number.isInteger(requestedMax)&&requestedMax>=1&&requestedMax<=10?requestedMax:1;
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
  pool.on('error',()=>console.error('PostgreSQL connection error'));
  return {query:(sql,args=[])=>pool.query(sql,args),close:()=>pool.end(),transaction:async fn=>{
    const client=await pool.connect();try{await client.query('BEGIN');const value=await fn(client);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }};
}
