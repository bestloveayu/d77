const {chromium}=require('C:/Users/bestl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
(async()=>{
 const server=spawn(process.execPath,['scripts/preview.mjs'],{env:{...process.env,PORT:'8792'},windowsHide:true});
 await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),calls=[];let subscribed=false,enabled=false;
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.google={accounts:{id:{initialize(o){window.fixtureLogin=o.callback;},renderButton(){},disableAutoSelect(){}}}};
   let sub=null;const registration={pushManager:{getSubscription:async()=>sub,subscribe:async()=>sub={toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/fixture',keys:{p256dh:'B'+'A'.repeat(86),auth:'A'.repeat(22)}}),unsubscribe:async()=>{sub=null;return true;}}}};
   Object.defineProperty(navigator,'serviceWorker',{value:{getRegistration:async()=>registration,register:async()=>registration,ready:Promise.resolve(registration)}});
   window.PushManager=class{};window.Notification={permission:'granted',requestPermission:async()=> 'granted'};
  });
  await page.route('https://accounts.google.com/**',r=>r.abort());
  await page.route('https://*.workers.dev/**',async r=>{
   const path=new URL(r.request().url()).pathname,body=r.request().postDataJSON();calls.push([path,body]);let value={};
   if(path==='/seasons')value={revision:0,defaultSeason:'2026秋',seasons:[{season:'2026秋'}],canManage:false};
   if(path==='/snapshot')value={snapshot:{season:'2026秋',updatedAt:new Date().toISOString(),summary:{orders:0,attention:0,shortages:0,unknownStock:0,rulesReady:0,rulesTotal:0},finance:{income:0,cost:0,profit:0,eastDue:0},products:[],orders:[]},viewer:'fixture@example.test'};
   if(path==='/notifications')value={events:[]};
   if(path==='/preferences'){if(body)enabled=body.pushEnabled;value={preferences:{pushEnabled:enabled,quiet:true,quietStart:22,quietEnd:8,types:['order']},pushAvailable:true};}
   if(path==='/push/status')value={available:true,publicKey:'BAAA',devices:subscribed?1:0};
   if(path==='/push/device'){if(body.op==='register')subscribed=true;if(body.op==='remove'){await new Promise(r=>setTimeout(r,1500));subscribed=false;}value={ok:true,subscribed};}
   await r.fulfill({json:value});
  });
  await page.goto('http://127.0.0.1:8792/');await page.waitForFunction(()=>window.fixtureLogin);
  await page.evaluate(()=>window.fixtureLogin({credential:'fixture-not-a-real-token'}));
  await page.locator('#settings').click();await page.locator('#push-enable:not([disabled])').waitFor();
  await page.locator('#push-enable').click();await page.locator('#push-test:not([disabled])').waitFor();assert(enabled);assert(subscribed);
  await page.locator('#push-test').click();await page.getByText('測試已交給推播服務，請查看手機通知',{exact:true}).waitFor();
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const bounds=await page.locator('#push-disable').boundingBox(),dialog=await page.locator('#detail').boundingBox();assert(bounds.x+bounds.width<=dialog.x+dialog.width,'push controls fit dialog');
   assert((await page.locator('#push-enable').boundingBox()).height<70,'phone buttons must not become vertical text');
   await page.screenshot({path:`test-results/push-settings-${width}.png`,fullPage:true});}
  await page.locator('#logout').click();await page.locator('#login:visible').waitFor({timeout:500});await page.waitForTimeout(1700);assert(!subscribed);assert(calls.some(([p,b])=>p==='/push/device'&&b.op==='remove'));assert.deepEqual(errors,[]);
  console.log('PASS push settings: enable/test/logout and 320/390/1440 layout (simulated browser subscription)');
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});

