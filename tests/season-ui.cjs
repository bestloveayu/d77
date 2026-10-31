const {chromium}=require('C:/Users/bestl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{fs.mkdirSync('test-results',{recursive:true});const b=await chromium.launch({channel:'msedge',headless:true});try{
  const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://accounts.google.com/**',r=>r.abort());await p.goto('http://127.0.0.1:8788');await p.getByRole('button',{name:'瀏覽示範資料'}).click();
  await p.locator('#season-select').selectOption('2026春');assert((await p.locator('#view').innerText()).includes('0'));assert.equal(await p.locator('.order').count(),0);
  await p.locator('#season-select').selectOption('2026秋');await p.locator('#settings').click();await p.locator('#season-manage').click();await p.locator('#season-add').click();
  const save=p.locator('#source-save');assert.equal(await save.isDisabled(),true);
  await p.locator('[name=year]').fill('2027');await p.locator('[name=period]').selectOption('春');
  await p.locator('[name=spreadsheetId]').fill('https://docs.google.com/spreadsheets/d/sample-book/edit?gid=7');
  await p.locator('[name=catalogSheet]').fill('2027春品項統計');await p.locator('[name=responseSheet]').fill('2027春預購回應');
  await p.locator('[name=rulesFolderId]').fill('https://drive.google.com/drive/folders/sample-folder');
  await p.locator('#source-test').click();await p.locator('.source-result.good').waitFor();assert.equal(await save.isEnabled(),true);
  await p.locator('[name=catalogSheet]').fill('2027春統計');assert.equal(await save.isDisabled(),true);assert((await p.locator('#source-test-result').innerText()).includes('重新測試'));
  await p.locator('#source-test').click();await p.locator('.source-result.good').waitFor();
  await p.locator('.source-advanced summary').click();
  for(const width of [320,390,430,1440]){
    await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert(await p.locator('#detail').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'dialog overflow '+width);
    await p.screenshot({path:`test-results/season-form-${width}.png`,fullPage:true});
  }
  await p.setViewportSize({width:390,height:844});await p.locator('[name=makeDefault]').check();await save.click();await p.locator('#season-add').waitFor();
  assert((await p.locator('.season-list').innerText()).includes('2027春'));assert.equal(await p.locator('#season-select').inputValue(),'2027春');
  await p.locator('#detail-close').click();await p.locator('#season-select').selectOption('2026秋');await p.locator('#nav [data-page=orders]').click();assert.equal(await p.locator('.order').count(),3);
  await p.locator('#season-select').selectOption('2027春');assert.equal(await p.locator('.order').count(),0);await p.locator('#nav [data-page=notifications]').click();assert.equal(await p.locator('.event').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS season selector, mobile add/test/edit invalidation/save, advanced sources, season isolation and 320/390/430/1440 widths. Demo only.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
