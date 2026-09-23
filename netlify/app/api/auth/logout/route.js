import {auth} from '../../../../lib/service.mjs';
import {assertOrigin,guarded,json,tokenFrom,clearCookie} from '../../../../lib/http.mjs';
export const runtime='nodejs';
export const POST=request=>guarded(async()=>{assertOrigin(request);await (await auth()).logout(tokenFrom(request));return json({ok:true},200,{'Set-Cookie':clearCookie()});});
