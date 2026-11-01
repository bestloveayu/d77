const {chromium}=require('C:/Users/bestl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
(async()=>{const server=spawn(process.execPath,['scripts/preview.mjs'],{env:{...process.env,PORT:'8791'},windowsHide:true});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});const browser=await chromium.launch({channel:'msedge',headless:true});try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://accounts.google.com/**',r=>r.abort());
  await page.route('**/',async route=>{const response=await route.fetch();const body=await response.text();await route.fulfill({response,body:body.replace('<div id="google-login">','<button id="demo-enter">Test fixture</button><div id="google-login">')});});
  await page.goto('http://127.0.0.1:8791/');await page.locator('#demo-enter').click();
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
  assert.deepEqual(errors,[]);console.log('PASS finance first, four fields, 320/390/1440 layouts without overflow. Synthetic data only.');
}finally{await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

