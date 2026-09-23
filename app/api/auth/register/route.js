import {auth} from '../../../../lib/service.mjs';
import {assertOrigin,body,guarded,json} from '../../../../lib/http.mjs';
import {AuthError} from '../../../../lib/auth.mjs';
export const runtime='nodejs';
export const POST=request=>guarded(async()=>{assertOrigin(request);if(process.env.ALLOW_REGISTRATION!=='true')throw new AuthError(403,'Регистрация закрыта. Обратитесь к организатору.');const input=await body(request);const user=await (await auth()).register(input);return json({user},201);});

