const {chromium}=require('C:/Users/bestl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{fs.mkdirSync('test-results',{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));await page.route('https://accounts.google.com/**',r=>r.abort());
await page.goto('http://127.0.0.1:8788');await page.getByRole('button',{name:'瀏覽示範資料'}).click();
await page.getByRole('heading',{name:'營運總覽'}).waitFor();
 assert((await page.locator('h1').first().evaluate(e=>getComputedStyle(e).fontFamily)).includes('Noto Serif TC'));
for(const [view,title] of [['overview','營運總覽'],['orders','顧客訂單'],['inventory','庫存查詢'],['rules','規則進度'],['notifications','通知中心']]){
 await page.locator(`#nav [data-page=${view}]`).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();
 await page.screenshot({path:`test-results/mobile-${view}.png`,fullPage:true});
 const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right]));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),view+' mobile overflow '+JSON.stringify(overflow));
}
await page.locator('#nav [data-page=orders]').click();await page.locator('#search').fill('示範顧客甲');assert.equal(await page.locator('.order').count(),1);
await page.locator('.order-name').first().click();await page.locator('#detail').waitFor({state:'visible'});assert((await page.locator('#detail-body').innerText()).includes('Sinabyss'));await page.locator('#detail-close').click();
await page.locator('#nav [data-page=inventory]').click();await page.getByRole('button',{name:'缺貨',exact:true}).click();assert(await page.locator('.stock-row').count()>0);
await page.locator('#nav [data-page=rules]').click();await page.getByRole('button',{name:'已完成',exact:true}).click();await page.locator('[data-rule]').first().click();assert((await page.locator('#detail-body').innerText()).includes('訂購顧客'));await page.locator('#detail-close').click();
await page.locator('#nav [data-page=notifications]').click();await page.getByRole('button',{name:'全部已讀',exact:true}).click();assert.equal(await page.locator('.event.unread').count(),0);
await page.locator('#settings').click();await page.locator('#prefs').waitFor();assert.equal(await page.locator('[name=pushEnabled]').isDisabled(),true);await page.getByRole('button',{name:'儲存設定'}).click();assert((await page.locator('#prefs-status').innerText()).includes('示範'));await page.locator('#detail-close').click();
await page.locator('#theme').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.screenshot({path:'test-results/mobile-night.png',fullPage:true});
await page.setViewportSize({width:1440,height:1000});await page.locator('#nav [data-page=overview]').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'test-results/desktop.png',fullPage:true});
assert.deepEqual(errors,[]);console.log('PASS five mobile views, desktop, search, details, stock filter, rule customers, read state, settings, night mode, no overflow/errors. Demo only.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
