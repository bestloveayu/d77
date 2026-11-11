const {chromium}=require('C:/Users/bestl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://accounts.google.com/**',r=>r.abort());
 await page.route('http://fixture.test/**',r=>{
   const url=new URL(r.request().url()),file=path.join(process.cwd(),'public',url.pathname==='/'?'index.html':decodeURIComponent(url.pathname));
   if(!fs.existsSync(file))return r.fulfill({status:404});
   let body=fs.readFileSync(file);
   if(path.basename(file)==='config.js')body=Buffer.from('window.BOARD_CONFIG={}');
   if(file.endsWith('app.js'))body=Buffer.from(body.toString()+`
     const line=(p,s,m)=>({name:'遊戲甲',originalName:'遊戲甲',quantity:1,price:100,purchased:p,shipped:s,mailed:m,evidence:{purchased:'confirmed',shipped:s===null?'missing':'confirmed',mailed:'missing'},noRulesRequired:false});
     data={season:'2026秋',updatedAt:new Date().toISOString(),orders:[{id:'a',name:'已下單顧客',lines:[line(1,null,null)],status:'待出貨',issues:[],followUp:{kind:'review'}},{id:'b',name:'已出貨顧客',lines:[line(1,1,null)],status:'已出貨',issues:[],followUp:{kind:'review'}}],products:[],finance:{income:0,cost:0,profit:0,eastDue:0},summary:{orders:2,shortages:0,rulesReady:0,rulesTotal:0}};
     events=[{id:'e',type:'purchase',title:'下單已確認',detail:'雲端已確認',target:{page:'orders',id:'a'},time:new Date().toISOString()}];
     seasonState={seasons:[{season:'2026秋'}]};selectedSeason='2026秋';showWorkspace();
   `);
   return r.fulfill({body,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html'});
 });
 await page.goto('http://fixture.test/');
 try{await page.getByRole('button',{name:'已下單顧客 · 下單已確認',exact:true}).waitFor({timeout:8000});}
 catch(e){console.error(errors,await page.locator('body').innerText());throw e;}
 await page.locator('#nav [data-page=orders]').click();
 await page.getByRole('button',{name:'待出貨登記',exact:true}).click();
 assert.equal(await page.locator('.order').count(),1);
 assert.match(await page.locator('.order').innerText(),/已下單顧客/);
 await page.getByRole('button',{name:'待寄規則',exact:true}).click();
 assert.equal(await page.locator('.order').count(),1);
 assert.match(await page.locator('.order').innerText(),/已出貨顧客/);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);
 console.log('Mobile existing activity customer names, missing-resource filters, and width passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

