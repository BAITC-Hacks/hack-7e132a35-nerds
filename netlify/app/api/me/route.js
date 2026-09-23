import {auth} from '../../../lib/service.mjs';
import {guarded,json,tokenFrom} from '../../../lib/http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=request=>guarded(async()=>json({user:await (await auth()).requireUser(tokenFrom(request))}));
