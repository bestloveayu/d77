const {build}=require('esbuild');const {Miniflare,convertV4MiniflareOptions}=require('miniflare');const assert=require('node:assert/strict');
(async()=>{const {outputFiles}=await build({entryPoints:['tests/push-runtime-worker.mjs'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'push-runtime-test',modules:true,script:outputFiles[0].text,compatibilityDate:'2026-10-01'}]}));
 try{const result=await(await mf.dispatchFetch('https://test/')).json();console.log(result);assert.equal(result.ok,true,'push encryption must work in Cloudflare runtime, not just Node');}
 finally{await mf.dispose();}
})().catch(e=>{console.error(e);process.exitCode=1;});

