const {chromium}=require('C:/Users/bestl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
(async()=>{const server=spawn(process.execPath,['scripts/preview.mjs'],{env:{...process.env,PORT:'8793'},windowsHide:true});await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://accounts.google.com/**',r=>r.abort());
 await page.route('**/',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('<div id="google-login">','<button id="demo-enter">Test fixture</button><div id="google-login">')});});
 await page.goto('http://127.0.0.1:8793/');await page.locator('#demo-enter').click();
 async function touch(type,x,y=440){await page.locator('#view').evaluate((el,{type,x,y})=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'||type==='touchcancel'?[]:[{clientX:x,clientY:y}]});Object.defineProperty(e,'changedTouches',{value:[{clientX:x,clientY:y}]});el.dispatchEvent(e);},{type,x,y});}
 await touch('touchstart',270);await touch('touchmove',150);
 assert.equal(await page.locator('.swipe-stage').count(),1,'a page preview must exist while the finger is still down');
 assert.equal(await page.locator('.swipe-incoming').getAttribute('data-page'),'orders');
 assert.equal(await page.locator('.swipe-outgoing').evaluate(el=>Math.round(new DOMMatrix(getComputedStyle(el).transform).m41)),-120);
 assert(!page.url().endsWith('#orders'),'dragging must not navigate before release');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:'test-results/swipe-drag-midpoint.png'});
 await touch('touchend',150);await page.waitForURL('**/#orders');await page.locator('.swipe-stage').waitFor({state:'detached'});
 await touch('touchstart',220);await touch('touchmove',190);await touch('touchend',190);await page.locator('.swipe-stage').waitFor({state:'detached'});assert(page.url().endsWith('#orders'),'short drag snaps back');
 await touch('touchstart',220);await touch('touchmove',215,570);assert.equal(await page.locator('.swipe-stage').count(),0,'vertical scrolling remains native');await touch('touchend',215,570);
 await touch('touchstart',220);await touch('touchmove',100);await touch('touchcancel',100);await page.locator('.swipe-stage').waitFor({state:'detached'});assert(page.url().endsWith('#orders'));
 await page.locator('#nav [data-page=notifications]').click();await touch('touchstart',270);await touch('touchmove',150);await touch('touchend',150);await page.waitForURL('**/#overview');await page.locator('.swipe-stage').waitFor({state:'detached'});
 await page.emulateMedia({reducedMotion:'reduce'});await touch('touchstart',120);await touch('touchmove',250);assert.equal(await page.locator('.swipe-stage').count(),0);await touch('touchend',250);await page.waitForURL('**/#notifications');
 assert.deepEqual(errors,[]);console.log('PASS finger-tracking preview, commit, snap-back, cancel, vertical scroll, circular wrap and reduced motion');
}finally{await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});

