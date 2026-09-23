import {getDatabase} from './db.mjs';
import {createAuth} from './auth.mjs';
export async function auth(){return createAuth(await getDatabase(),{sessionHours:process.env.SESSION_HOURS||12});}
