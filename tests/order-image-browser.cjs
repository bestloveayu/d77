const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {mkdir}=require('node:fs/promises');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:360,height:780},acceptDownloads:true});
    await page.setContent('<main><article id="a"></article><article id="b"></article></main><nav style="position:fixed;inset:auto 0 0;height:65px">導覽</nav>');
    await page.addStyleTag({path:path.join(__dirname,'../public/order-image.css')});
    await page.addScriptTag({path:path.join(__dirname,'../public/order-image.js')});
    await page.evaluate(()=>{
      Object.defineProperty(navigator,'canShare',{value:()=>true});
      Object.defineProperty(navigator,'share',{value:async ({files})=>{window.shared=files[0].type;}});
      const entries=['a','b'].map((id,i)=>{
        const article=document.getElementById(id);
        return {article,area:article,order:{name:'示範顧客',total:1490,lines:[{name:i?'森林郵差：旅行擴充':'月光花園',quantity:1,price:1490}]}};
      });
      D77OrderImage.mount(document.querySelector('main'),entries,{season:'2026秋',share:true,dock:document.querySelector('nav')});
    });
    await page.getByRole('button',{name:'下載圖片',exact:true}).first().click();
    await page.getByRole('link',{name:'下載 PNG'}).waitFor();
    await page.locator('dialog img').evaluate(img=>img.decode());
    assert.equal(await page.locator('dialog img').evaluate(img=>img.naturalWidth),720);
    await page.getByRole('button',{name:'分享圖片'}).click();
    assert.equal(await page.evaluate(()=>window.shared),'image/png');
    const downloaded=page.waitForEvent('download');await page.getByRole('link',{name:'下載 PNG'}).click();
    assert.match((await downloaded).suggestedFilename(),/\.png$/);
    await mkdir(path.join(__dirname,'../test-results'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'../test-results/order-image-mobile.png')});
    await page.getByRole('button',{name:'關閉'}).click();
    const dock=page.locator('.order-export-dock');
    assert.equal(await dock.isVisible(),false);
    const selections=await page.getByRole('checkbox').all();
    await selections[0].check();
    assert.match(await dock.innerText(),/已選 1 筆/);
    await selections[0].uncheck();
    assert.equal(await dock.isVisible(),false);
    for(const checkbox of selections)await checkbox.check();
    assert.match(await dock.innerText(),/已選 2 筆/);
    await page.setViewportSize({width:320,height:720});
    const barBox=await dock.boundingBox(),navBox=await page.locator('nav').boundingBox();
    assert.ok(Math.abs(barBox.y+barBox.height-navBox.y)<2);
    assert.ok(barBox.x>=0&&barBox.x+barBox.width<=320);
    await page.getByRole('button',{name:'下載所選圖片'}).click();
    await page.getByRole('link',{name:'下載 ZIP'}).waitFor();
    await page.getByRole('checkbox',{name:'確認為同一位顧客，合成一張圖片'}).check();
    await page.getByRole('link',{name:'下載 PNG'}).waitFor();
    await page.locator('dialog img').evaluate(img=>img.decode());
    assert.ok(await page.locator('dialog img').evaluate(img=>img.naturalHeight>500));
    assert.ok(await page.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));
    console.log('PNG download, ZIP preparation, opt-in merge, share handoff and narrow preview passed');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
