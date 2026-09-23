import fs from 'node:fs/promises';
import path from 'node:path';
import {auth} from '../../../lib/service.mjs';
import {tokenFrom,guarded,json} from '../../../lib/http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=(request,context)=>guarded(async()=>{
  await (await auth()).requireUser(tokenFrom(request));
  const {asset}=await context.params;
  if(!['app.js','model.js'].includes(asset))return json({error:'Не найдено'},404);
  return new Response(await fs.readFile(path.join(process.cwd(),'simulator',asset),'utf8'),{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}});
});
