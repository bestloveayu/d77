const {chromium}=require('C:/Users/bestl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
(async()=>{const server=spawn(process.execPath,['scripts/preview.mjs'],{env:{...process.env,PORT:'8794'},windowsHide:true});await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://accounts.google.com/**',r=>r.abort());
 await page.route('**/',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('<div id="google-login">','<button id="demo-enter">Test fixture</button><div id="google-login">')});});
 await page.goto('http://127.0.0.1:8794/');await page.locator('#demo-enter').click();
 for(const name of ['orders','inventory','rules']){
  await page.locator(`#nav [data-page=${name}]`).click();await page.locator('#search').focus();
  assert(await page.locator('#search').evaluate(input=>{
   input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.value='ㄑ';
   input.dispatchEvent(new InputEvent('input',{bubbles:true,data:'ㄑ',isComposing:true,inputType:'insertCompositionText'}));
   return input.isConnected&&document.activeElement===input;
  }),`${name}: composing input must not be replaced`);
  await page.locator('#search').evaluate(input=>{input.value='企鵝';input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'企鵝'}));input.dispatchEvent(new InputEvent('input',{bubbles:true,data:'企鵝',inputType:'insertText'}));});
  assert.equal(await page.locator('#search').inputValue(),'企鵝');assert((await page.locator('#view').innerText()).includes('企鵝之路'));
 }
 await page.locator('#nav [data-page=inventory]').click();
 const headers=await page.locator('.inventory-stock .stock-head').innerText();assert(headers.includes('待出貨量')&&headers.includes('全新')&&headers.includes('二手'));
 await page.locator('#sort').selectOption('ordered-desc');assert((await page.locator('.inventory-stock .stock-row').first().innerText()).includes('企鵝之路'));
 await page.locator('#sort').selectOption('stock-desc');assert((await page.locator('.inventory-stock .stock-row').first().innerText()).includes('北海'));
 await page.locator('[data-filter=used]').click();assert.equal(await page.locator('.inventory-stock .stock-row').count(),1);assert.deepEqual(await page.locator('.inventory-stock .stock-row .num').allTextContents(),['4','10','1']);
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`test-results/inventory-split-${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS composition input across orders/inventory/rules, split stock columns, descending sorts and responsive layout');
}finally{await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
