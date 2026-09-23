import {json} from '../../../../lib/http.mjs';
export const dynamic='force-dynamic';
export const GET=()=>json({registration:process.env.ALLOW_REGISTRATION==='true'});
