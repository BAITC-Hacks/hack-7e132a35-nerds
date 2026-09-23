import {getDatabase} from '../../../lib/db.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{await (await getDatabase()).query('SELECT u.id, s.token_hash, l.key FROM users u, sessions s, auth_limits l LIMIT 0');return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}}
