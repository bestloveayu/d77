const {chromium}=require('C:/Users/bestl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
(async()=>{const server=spawn(process.execPath,['scripts/preview.mjs'],{env:{...process.env,PORT:'8791'},windowsHide:true});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://accounts.google.com/**',r=>r.abort());
  await page.route('**/demo.js',async route=>{const response=await route.fetch();const body=await response.text();await route.fulfill({response,body:body.replace('return {fictional:true','orders.forEach(o=>{o.progress={total:3,purchased:2,shipped:1,mailed:0,ruleTotal:2,purchaseUnknown:1,shipmentUnknown:1,mailUnknown:2};});return {fictional:true')});});
  await page.route('**/',async route=>{const response=await route.fetch();const body=await response.text();await route.fulfill({response,body:body.replace('<div id="google-login">','<button id="demo-enter">Test fixture</button><div id="google-login">')});});
  await page.goto('http://127.0.0.1:8791/');await page.locator('#demo-enter').click();
  assert((await page.title()).includes('雲端管理'));
  assert.equal(await page.locator('.brand small').count(),0);
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:900});await page.locator('.finance-overview').waitFor();
    assert.equal(await page.locator('.finance-overview>div').count(),4);
    assert(!(await page.locator('.season-due').innerText()).includes('該季帳款差額'));
    const label=await page.locator('.season-due small').boundingBox();
    const peer=await page.locator('.finance-overview>div').nth(width<=620?2:0).locator('small').boundingBox();
    assert(Math.abs(label.y-peer.y)<1,'account label must align with peer labels');
    const amount=await page.locator('.season-due strong').boundingBox();
    const peerAmount=await page.locator('.finance-overview>div').nth(width<=620?2:0).locator('strong').boundingBox();
    assert(Math.abs(amount.y-peerAmount.y)<1,'account amount must align with peer amounts');
    const a=await page.locator('.overview-finance').boundingBox(),b=await page.locator('.metrics').boundingBox();assert(a.y+a.height<=b.y+1);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`test-results/overview-finance-${width}.png`,fullPage:true});
  }
  await page.locator('#nav [data-page=orders]').click();
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:900});
    assert((await page.locator('.order').first().innerText()).includes('部分無紀錄'));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`test-results/order-progress-${width}.png`,fullPage:true});
  }
  await page.locator('.order-name').first().click();
  assert((await page.locator('#detail').innerText()).includes('出貨'));
  await page.setViewportSize({width:390,height:900});
  async function swipe(selector,dx,dy=0){await page.locator(selector).evaluate((el,{dx,dy})=>{for(const [type,x,y] of [['touchstart',200,250],['touchend',200+dx,250+dy]]){const e=new Event(type,{bubbles:true});Object.defineProperty(e,'touches',{value:type==='touchstart'?[{clientX:x,clientY:y}]:[]});Object.defineProperty(e,'changedTouches',{value:[{clientX:x,clientY:y}]});el.dispatchEvent(e);}},{dx,dy});}
  await swipe('#page-title',-100);assert(page.url().endsWith('#orders'),'dialog blocks swipe');
  await page.locator('#detail-close').click();
  await page.locator('#nav [data-page=notifications]').click();
  await swipe('#page-title',-100);await page.waitForURL('**/#overview');
  await page.locator('#view').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
  await page.waitForTimeout(250);
  await swipe('#page-title',100);await page.waitForURL('**/#notifications');
  await page.waitForTimeout(350);
  await swipe('#page-title',-100,200);assert(page.url().endsWith('#notifications'),'vertical scrolling must not navigate');
  await page.locator('#nav [data-page=inventory]').click();
  assert((await page.locator('.stock-head').innerText()).includes('訂購量'));
  assert(!(await page.locator('.stock-head').innerText()).includes('已確認出貨'));
  assert(!(await page.locator('.inventory-stock').innerText()).includes('待核對'));
  await swipe('#search',-100);assert(page.url().endsWith('#inventory'),'search blocks swipe');
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`test-results/inventory-simple-${width}.png`,fullPage:true});
  }
  await page.locator('[data-product]').first().click();
  assert((await page.locator('#detail').innerText()).includes('已確認出貨'));
  assert((await page.locator('#detail').innerText()).includes('待出'));
  assert.deepEqual(errors,[]);console.log('PASS finance alignment and order progress at 320/390/1440 without overflow. Synthetic data only.');
}finally{await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

