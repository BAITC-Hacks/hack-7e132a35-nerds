import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');process.chdir(root);
const check=spawnSync('docker',['compose','version'],{stdio:'inherit',windowsHide:true});
if(check.status!==0){console.error('Install and start Docker Desktop with Linux containers.');process.exit(1);}
if(!fs.existsSync('.review.env')){
  const port=Number(process.argv[2]||3000);
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Port must be 1024–65535');
  fs.writeFileSync('.review.env',`POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}\nAPP_DB_PASSWORD=${randomBytes(24).toString('hex')}\nAPP_PORT=${port}\n`,{mode:0o600});
}
const port=fs.readFileSync('.review.env','utf8').match(/^APP_PORT=(\d+)$/m)?.[1]||3000;
console.log(`Open http://localhost:${port} when the server is ready. Register your own account.`);
const child=spawn('docker',['compose','--env-file','.review.env','up','--build'],{stdio:'inherit',windowsHide:true});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code||0;});
