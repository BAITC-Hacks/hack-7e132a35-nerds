import fs from 'node:fs/promises';
import path from 'node:path';
import {auth} from '../../lib/service.mjs';
import {tokenFrom,guarded} from '../../lib/http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=request=>guarded(async()=>{
  const user=await (await auth()).requireUser(tokenFrom(request));
  let html=await fs.readFile(path.join(process.cwd(),'simulator/index.html'),'utf8');
  html=html.replace('<script src="model.js"></script>','<script src="/simulator/model.js"></script>').replace('<script src="app.js"></script>','<script>window.AKIM_USER_ID='+JSON.stringify(user.id)+';</script><script src="/simulator/app.js"></script>');
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
});
