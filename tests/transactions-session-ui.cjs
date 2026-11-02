const {chromium}=require('C:/Users/bestl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),{spawn}=require('node:child_process');
(async()=>{
 const server=spawn(process.execPath,['scripts/preview.mjs'],{env:{...process.env,PORT:'8793'},windowsHide:true});
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),calls=[],errors=[];let revoked=false;page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.google={accounts:{id:{initialize(o){window.fixtureLogin=o.callback},renderButton(){},disableAutoSelect(){}}}}});
  await page.route('https://accounts.google.com/**',r=>r.abort());
  await page.route('https://*.workers.dev/**',async route=>{
   const path=new URL(route.request().url()).pathname;calls.push([path,route.request().method(),route.request().headers().authorization]);let value={};
   if(revoked){await route.fulfill({status:403,json:{error:'帳號已撤銷',code:'AUTH_FORBIDDEN'}});return;}
   if(path==='/session')value={token:'d77s_'+'a'.repeat(64),viewer:'fixture@example.test',expiresAt:Date.now()+30*86400000};
   if(path==='/seasons')value={defaultSeason:'2026秋',seasons:[{season:'2026秋'}]};
   if(path==='/snapshot')value={viewer:'fixture@example.test',snapshot:{season:'2026秋',updatedAt:new Date().toISOString(),orders:[],products:[],summary:{orders:0,shortages:0,rulesReady:0,rulesTotal:0},finance:{income:100,cost:0,profit:100,eastDue:50},transactions:[{id:'row-2',sourceRow:2,kind:'銷貨收入',subject:'測試客人',name:'遊戲甲',time:'2026/11/1',amount:100,income:100,cost:0,quantity:-1,transactionId:'test-transaction',note:'GM / 出貨 / 測試客人',actor:'小東',settlement:0},{id:'row-3',sourceRow:3,kind:'其他成本',subject:'住宿',name:'',time:'2026/10/1',amount:40,income:0,cost:40,quantity:0,note:'GM / 其他支出 / 住宿',actor:'于正',settlement:0}]}};
   if(path==='/notifications')value={events:[]};
   if(path==='/preferences')value={preferences:{pushEnabled:false,quiet:true,quietStart:22,quietEnd:8,types:[]}};
   if(path==='/push/status')value={available:false};
   await route.fulfill({json:value});
  });
  await page.goto('http://127.0.0.1:8793/');await page.waitForFunction(()=>window.fixtureLogin);
  await page.locator('#remember-login').check();await page.evaluate(()=>window.fixtureLogin({credential:'google-fixture'}));
  await page.locator('[data-go=transactions]').click();
  assert.equal(await page.locator('[data-transaction]').count(),2);
  await page.locator('[data-filter="其他成本"]').click();assert.equal(await page.locator('[data-transaction]').count(),1);
  await page.locator('[data-filter=all]').click();await page.locator('#search').fill('測試客人');assert.equal(await page.locator('[data-transaction]').count(),1);
  await page.locator('[data-transaction]').click();assert((await page.locator('#detail-body').innerText()).includes('test-transaction'));
  await page.locator('#detail-close').click();
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`test-results/transactions-${width}.png`,fullPage:true});}
  const storage=await page.evaluate(()=>JSON.stringify(localStorage));assert(!storage.includes('google-fixture'));assert(storage.includes('d77s_'));
  await page.reload();await page.locator('#workspace:visible').waitFor();assert(calls.some(([p,m,a])=>p==='/session'&&m==='GET'&&a.startsWith('Bearer d77s_')));
  await page.locator('#settings').click();await page.locator('#logout').click();await page.locator('#login:visible').waitFor();
  await page.waitForFunction(()=>!localStorage.getItem('d77-session'));
  assert(calls.some(([p])=>p==='/session/logout'));
  await page.locator('#remember-login').check();await page.evaluate(()=>window.fixtureLogin({credential:'google-fixture'}));await page.locator('#workspace:visible').waitFor();
  revoked=true;await page.locator('#refresh').click();await page.locator('#login:visible').waitFor();assert.equal(await page.locator('#view').innerText(),'');revoked=false;
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='d77-session')throw new DOMException('blocked','SecurityError');return set.call(this,k,v)}});
  await page.evaluate(()=>window.fixtureLogin({credential:'google-fixture'}));await page.locator('#workspace:visible').waitFor();assert((await page.locator('#error').innerText()).includes('不允許保存登入'));
  await page.evaluate(()=>{const remove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(k){if(k==='d77-session')throw new DOMException('blocked','SecurityError');return remove.call(this,k)}});
  await page.locator('#settings').click();await page.locator('#logout').click();await page.locator('#login:visible').waitFor();assert.equal(await page.locator('#view').innerText(),'');assert.deepEqual(errors,[]);
  console.log('PASS transaction filters/details/mobile layout and opt-in session restore/revoke; mocked authentication only');
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
