const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:320,height:720}});
    const read=name=>fs.readFile(path.join(__dirname,'../public',name),'utf8');
    const module=await read('rule-copy.js');
    await page.setContent('<meta charset="utf-8"><main><article class="rule-row"><div class="rule-art"></div><button data-rule="甲">甲</button></article><article class="rule-row"><div class="rule-art"></div><button data-rule="乙">乙</button></article></main><nav id="nav" class="bottom-nav"></nav><dialog></dialog>');
    await page.addStyleTag({content:await read('style.css')});
    await page.addStyleTag({content:await read('order-image.css')});
    await page.evaluate(async source=>{
      const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
      const {mountRuleCopy}=await import(url);URL.revokeObjectURL(url);
      Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text;}}});
      mountRuleCopy(document.querySelector('main'),document.querySelector('nav'),[{name:'甲',rules:[{url:'https://example.com/rules'}]},{name:'乙',rules:[]}],(_,body)=>{const d=document.querySelector('dialog');d.innerHTML=body;d.showModal();},s=>s);
    },module);
    const toggle=page.getByRole('button',{name:'甲 的規則連結'});
    const arts=await page.locator('.rule-art').all();
    const a=await arts[0].boundingBox(),b=await arts[1].boundingBox();
    assert.deepEqual([a.x,a.width,a.height],[b.x,b.width,b.height]);
    await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'true');
    await page.getByRole('button',{name:'產生並複製'}).click();
    const field=page.getByRole('textbox',{name:'規則連結文字'});
    assert.ok((await field.boundingBox()).height>300);
    assert.match(await page.evaluate(()=>window.copied),/example.com\/rules/);
    await field.fill('補充說明：請先下載檔案。');
    await page.getByRole('button',{name:'複製文字'}).click();
    assert.equal(await page.evaluate(()=>window.copied),'補充說明：請先下載檔案。');
    console.log('Aligned rule icons, pressed state, tall editor and copying edited text passed');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
