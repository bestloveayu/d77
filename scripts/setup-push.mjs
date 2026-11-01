import {generateKeyPairSync} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
const cli=path.resolve('node_modules/wrangler/bin/wrangler.js');
const env={...process.env,XDG_CONFIG_HOME:path.resolve('.config'),WRANGLER_LOG_PATH:path.resolve('.config/logs'),WRANGLER_SEND_METRICS:'false'};
function wrangler(args,input){return new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[cli,...args],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('error',reject);
 child.on('exit',code=>code===0?resolve(stdout):reject(Error('Wrangler operation failed: '+stderr)));
 child.stdin.end(input||'');
});}
const secrets=JSON.parse(await wrangler(['secret','list']));
const names=secrets.map(s=>s.name);
if(names.includes('VAPID_PUBLIC_KEY')&&names.includes('VAPID_PRIVATE_KEY')){
 console.log('Existing VAPID credentials preserved.');
}else{
 if(names.some(n=>n.startsWith('VAPID_')))throw Error('Partial VAPID setup exists; refusing to rotate credentials.');
 const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=privateKey.export({format:'jwk'});
 const publicKey=Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]).toString('base64url');
 await wrangler(['secret','put','VAPID_PRIVATE_KEY'],jwk.d);
 await wrangler(['secret','put','VAPID_PUBLIC_KEY'],publicKey);
 console.log('VAPID credentials stored in Worker secrets. Private key was not saved or printed.');
}

