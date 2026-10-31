import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const folders=['public','worker','tests','scripts','docs','.github'];
const files=['README.md','.gitignore','package.json','package-lock.json','wrangler.toml'];
function walk(folder){for(const entry of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){const name=folder+'/'+entry.name;if(entry.isDirectory())walk(name);else if(!name.endsWith('seasons.png'))files.push(name);}}
folders.forEach(walk);
const entries=files.map(name=>{const file=path.join(root,name),binary=/\.(?:webp|png|ttf)$/.test(name);return {path:name,mode:'100644',type:'blob',binary,content:fs.readFileSync(file,binary?'base64':'utf8')};});
for(const entry of entries){if(/\.sqlite(?:3)?$/.test(entry.path)||/^-----BEGIN (?:RSA )?PRIVATE KEY-----$/m.test(entry.content)||/"private_key"\s*:\s*"-----BEGIN/.test(entry.content))throw new Error('Private material detected: '+entry.path);}
if(process.argv.includes('--list'))console.log(JSON.stringify(entries.map(({path,binary,content})=>({path,binary,length:content.length}))));
else console.log(JSON.stringify(entries));
