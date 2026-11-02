const {chromium}=require('C:/Users/bestl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
(async()=>{const server=spawn(process.execPath,['scripts/preview.mjs'],{env:{...process.env,PORT:'8795'},windowsHide:true});await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://accounts.google.com/**',r=>r.abort());
 await page.route('**/demo.js',async r=>{const response=await r.fetch();const body=(await response.text()).replace('return {fictional:true',`orders[0].status='待出貨';orders[0].lines.forEach(l=>Object.assign(l,{purchased:l.quantity,shipped:0,mailed:0,noRulesRequired:false,evidence:{purchased:'confirmed',shipped:'confirmed',mailed:'confirmed'}}));orders[1].status='已出貨';orders[1].lines.forEach(l=>Object.assign(l,{purchased:l.quantity,shipped:l.quantity,mailed:0,noRulesRequired:false,evidence:{purchased:'confirmed',shipped:'confirmed',mailed:'confirmed'}}));return {fictional:true`);await r.fulfill({response,body});});
 await page.route('**/',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('<div id="google-login">','<button id="demo-enter">Test fixture</button><div id="google-login">')});});
 await page.goto('http://127.0.0.1:8795/');await page.locator('#demo-enter').click();
 assert((await page.locator('.alert-row[data-go=orders][data-filter=registration]').innerText()).includes('1'));
 assert((await page.locator('[data-go=orders][data-filter=rules]').innerText()).includes('1'));
 await page.locator('.alert-row[data-go=orders][data-filter=registration]').click();assert.equal(await page.locator('.order').count(),1);assert((await page.locator('.order').innerText()).includes('示範顧客甲'));
 await page.locator('[data-filter=rules]').click();assert.equal(await page.locator('.order').count(),1);assert((await page.locator('.order').innerText()).includes('示範顧客乙'));
 await page.locator('[data-filter=pending]').click();assert.equal(await page.locator('.order').count(),0,'pending purchase must not include shipped rules-only orders or unknown purchase evidence');
 await page.locator('[data-filter=review]').click();assert.equal(await page.locator('.order').count(),1);assert((await page.locator('.order').innerText()).includes('示範顧客丙'));
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`test-results/followup-orders-${width}.png`,fullPage:true});}
 await page.locator('#settings').click();assert.equal(await page.locator('input[name=types][value=registration]').count(),1);assert.equal(await page.locator('input[name=types][value=rules-pending]').count(),1);assert.deepEqual(errors,[]);
 console.log('PASS follow-up counts, drill-down filters, review separation, notification settings and mobile layout');
}finally{await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
