const {chromium}=require('C:/Users/bestl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),{spawn}=require('node:child_process');
(async()=>{
 const server=spawn(process.execPath,['scripts/preview.mjs'],{env:{...process.env,PORT:'8797'},windowsHide:true});
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j)});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[],reports=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>window.google={accounts:{id:{initialize(o){window.fixtureLogin=o.callback},renderButton(){},disableAutoSelect(){}}}});
  await page.route('https://accounts.google.com/**',r=>r.abort());
  const lines=[{name:'企鵝之路',quantity:1,price:100,purchased:1,shipped:1,mailed:0},{name:'維新前夜',quantity:1,price:200,purchased:1,shipped:1,mailed:0}];
  const orders=[{id:'order-a',name:'王小明',total:300,time:'2026/11/14 10:00',lines,status:'已出貨',issues:[]},{id:'order-b',name:'王小明',total:100,time:'2026/11/14 10:00',lines:[lines[0]],status:'已出貨',issues:[]},{id:'order-c',name:'陳小華',total:100,time:'2026/11/14 10:00',lines:[lines[0]],status:'已出貨',issues:[]}];
  const products=lines.map(l=>({name:l.name,ordered:3,stock:3,rules:[{name:l.name+'_中文規則.pdf',url:'https://example.com/'+encodeURIComponent(l.name)}],customers:[]}));
  await page.route('https://*.workers.dev/**',async r=>{
   const path=new URL(r.request().url()).pathname;let value={};
   if(path==='/seasons')value={defaultSeason:'2026秋',seasons:[{season:'2026秋'}]};
   if(path==='/snapshot')value={viewer:'fixture@example.test',snapshot:{season:'2026秋',updatedAt:new Date().toISOString(),orders,products,transactions:[],finance:{income:0,cost:0,profit:0},summary:{orders:3,shortages:0,rulesReady:2,rulesTotal:2}}};
   if(path==='/notifications')value={events:[]};
   if(path==='/mail-recipients')value={recipients:orders.filter(o=>r.request().postDataJSON().orderIds.includes(o.id)).map(o=>({id:o.id,name:o.name,email:o.id==='order-c'?'c@example.com':'a@example.com'}))};
   if(path==='/mail-report'){reports.push(r.request().postDataJSON());value={ok:true};}
   await r.fulfill({json:value});
  });
  await page.goto('http://127.0.0.1:8797/#orders');await page.waitForFunction(()=>window.fixtureLogin);await page.evaluate(()=>window.fixtureLogin({credential:'fixture'}));await page.locator('.order-name-check').first().waitFor();
  await page.locator('.order-name-check').nth(0).check();await page.locator('.order-name-check').nth(1).check();await page.locator('.order-name-check').nth(2).check();
  await page.locator('.order-export-dock button').filter({hasText:'下載所選圖片'}).click();
  await page.locator('.order-image-editor .order-image-shortage').nth(1).click();
  await page.locator('.order-image-actions button').filter({hasText:'Email 預覽'}).click();
  const dialog=page.locator('.email-preview-dialog').filter({has:page.locator('[data-body]')});await dialog.waitFor();
  assert.equal(await dialog.locator('[data-customer] option').count(),2);assert.match(await dialog.locator('[data-body]').inputValue(),/總金額：\$200/);assert.match(await dialog.locator('[data-body]').inputValue(),/維新前夜 ×1，小計 缺貨/);
  assert.doesNotMatch(await dialog.locator('[data-body]').inputValue(),/維新前夜】/);assert.equal(await dialog.locator('[data-report]').isDisabled(),true);
  await dialog.locator('[data-body]').fill((await dialog.locator('[data-body]').inputValue())+'\n自訂文字');
  assert.match(await dialog.locator('[data-open]').getAttribute('href'),/mailto:a%40example.com/);
  await dialog.locator('[data-copy]').click();await dialog.locator('[data-ack]').check();
  // Headless clipboard may be unavailable; explicitly trigger a non-navigating mailto click.
  await dialog.locator('[data-open]').evaluate(el=>{el.addEventListener('click',e=>e.preventDefault(),{once:true});el.click();});
  await dialog.locator('[data-report]').click();await page.waitForFunction(()=>document.querySelector('.email-preview-dialog [role=status]')?.textContent.includes('已儲存'));
  assert.equal(reports.length,1);assert.equal(reports[0].kind,'rules');assert.deepEqual(reports[0].items,['企鵝之路']);assert.deepEqual(reports[0].orderIds,['order-a','order-b']);
  assert.equal(await dialog.locator('[data-report]').isDisabled(),true);
  await dialog.locator('[data-customer]').selectOption('1');assert.equal(await dialog.locator('[data-to]').inputValue(),'c@example.com');
  await dialog.locator('[data-to]').fill('changed@example.com');await dialog.locator('[data-ack]').check();assert.equal(await dialog.locator('[data-report]').isDisabled(),true);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});await dialog.evaluate(d=>d.scrollTop=0);assert(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth+1));await page.screenshot({path:`test-results/email-preview-${width}.png`});}
  await page.goto('http://127.0.0.1:8797/?widgetOrder=order-a&widgetAction=email#orders');await page.waitForFunction(()=>window.fixtureLogin);await page.evaluate(()=>window.fixtureLogin({credential:'fixture'}));
  await page.locator('.email-preview-dialog [data-body]').waitFor();assert.equal(await page.locator('.email-preview-dialog [data-to]').inputValue(),'a@example.com');assert.equal(reports.length,1);
  await page.goto('http://127.0.0.1:8797/?widgetProduct='+encodeURIComponent('企鵝之路')+'&widgetAction=copy-rules#rules');await page.waitForFunction(()=>window.fixtureLogin);await page.evaluate(()=>window.fixtureLogin({credential:'fixture'}));await page.locator('#widget-copy-rules').waitFor();assert.match(await page.locator('.rule-copy-text').inputValue(),/企鵝之路/);
  await page.evaluate(async()=>{const {openEmailPreview}=await import('/email-preview.js');window.reportAttempts=[];openEmailPreview([{id:'a',name:'測試',email:'test@example.com',lines:[{name:'甲',quantity:1,price:100}]}],{products:[{name:'甲',rules:[{url:'https://example.com/rule'}]}],report:async payload=>{window.reportAttempts.push(structuredClone(payload));if(window.reportAttempts.length===1)throw Error('模擬逾時');}});});
  const retry=page.locator('.email-preview-dialog');await retry.locator('[data-open]').evaluate(el=>{el.addEventListener('click',e=>e.preventDefault());el.click();});await retry.locator('[data-ack]').check();await retry.locator('[data-report]').click();await page.waitForFunction(()=>document.querySelector('.email-preview-dialog [role=status]')?.textContent.includes('模擬逾時'));
  assert.equal(await retry.locator('[data-rules]').isDisabled(),true);assert.equal(await retry.locator('[data-body]').isDisabled(),true);await retry.locator('[data-report]').click();await page.waitForFunction(()=>window.reportAttempts.length===2);assert.deepEqual(await page.evaluate(()=>window.reportAttempts[0]),await page.evaluate(()=>window.reportAttempts[1]));
  assert.deepEqual(errors,[]);console.log('PASS mobile text email grouping, shortage draft, editing, manual-report confirmation, no mixed recipients; synthetic only');
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});

