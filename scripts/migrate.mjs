import fs from 'node:fs/promises';
import {getDatabase} from '../lib/db.mjs';
const db=await getDatabase();
try{await db.transaction(async tx=>{await tx.query(await fs.readFile(new URL('../db/001_auth.sql',import.meta.url),'utf8'));});console.log('Auth tables are ready.');}finally{await db.close();}
