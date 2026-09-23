import {auth} from '../../../../lib/service.mjs';
import {assertOrigin,body,guarded,json,tokenFrom,sessionCookie} from '../../../../lib/http.mjs';
export const runtime='nodejs';
export const POST=request=>guarded(async()=>{assertOrigin(request);const input=await body(request);const result=await (await auth()).login(input,tokenFrom(request));return json({user:result.user},200,{'Set-Cookie':sessionCookie(result.token,result.expires)});});
