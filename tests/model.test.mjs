import test from 'node:test';
import assert from 'node:assert/strict';
import {compose,changes,decodeTeam,digest,safeUrl,parseResponses,catalog,ledger} from '../worker/model.mjs';
const config={season:'2026秋',spreadsheetId:'book',responseSheet:'2026秋預購回應',aliases:{'A遊戲甲':'遊戲甲'}};
const input=()=>({catalog:[['中文名稱','外文名稱','代購(台)','訂購量','預約量','攤位','規則書'],['遊戲甲','Game A',100,3,3,'57','']],
  responses:[['時間戳記','真實姓名','電子郵件地址','手機號碼','FB暱稱','2026GM [A遊戲甲 2-3人：100元]'],['2026/11/1 上午 8:00','測試本名','test@example.com','0912345678','小測試',2]],
  ledger:[['品項','增減數量','東收入','于收入','東支出','于支出','季別'],['遊戲甲',3,'','','',300,'2025秋'],['遊戲甲',-1,100,'','','','2026秋']],
  team:{teamId:'team',resources:[],operations:[]},documents:{teamId:'team',documents:[]},rules:[]});
test('unknown shipment is not zero; contacts not exposed; canonical name only via explicit alias',async()=>{
  const result=await compose(input(),config);
  assert.equal(result.orders[0].name,'測試本名');assert.equal(result.orders[0].email,undefined);assert.equal(result.orders[0].phone,undefined);
  assert.equal(result.products[0].stock,2);assert.equal(result.products[0].shortage,null);
  assert.equal(result.products[0].ordered,2);assert.equal(result.orders[0].lines[0].name,'遊戲甲');
  assert.equal(result.finance.income,100);assert.equal(result.finance.cost,0);
});
test('resource hashes match Python collaboration contract and preserve partial shipment',async()=>{
  const source=input();
  const origin=['2026秋','book','2026秋預購回應',2,5];
  source.team.resources=[{key:await digest(['shipment',...origin,'']),fingerprint:await digest([origin,'A遊戲甲',2]),doneQuantity:1,season:'2026秋'}];
  const result=await compose(source,config);
  assert.equal(result.orders[0].lines[0].shipped,1);assert.equal(result.products[0].outstanding,1);assert.equal(result.products[0].shortage,0);
});
test('changed source fingerprint remains unknown rather than inheriting shipment',async()=>{
  const source=input();source.team.resources=[{key:await digest(['shipment','2026秋','book',config.responseSheet,2,5,'']),fingerprint:'wrong',doneQuantity:1,season:'2026秋'}];
  const result=await compose(source,config);assert.equal(result.orders[0].status,'待核對');assert.equal(result.orders[0].lines[0].shipped,null);
});
test('manual tombstones excluded and stable manual line IDs used',async()=>{
  const source=input();source.documents.documents=[{kind:'manualOrder',season:'2026秋',id:'removed',deleted:true,body:{}},{kind:'manualOrder',season:'2026秋',id:'a'.repeat(32),deleted:false,body:{name:'手動顧客',items:[{name:'遊戲甲',quantity:1,unitPrice:100,localLineId:'b'.repeat(32)}]}}];
  const result=await compose(source,config);assert.equal(result.orders.length,2);assert.equal(result.orders[1].manual,true);
});
test('invalid quantities not silently ignored',async()=>{
  const source=input();source.responses[1][5]='我要兩盒';const result=await compose(source,config);assert.equal(result.orders[0].total,null);assert.equal(result.products[0].ordered,null);
});
test('Drive cards and rule file links; unsafe URLs rejected',async()=>{
  const source=input();source.rules=[{id:'r',name:'遊戲甲_中文規則.pdf'},{id:'c',name:'遊戲甲_中文卡牌.pdf'}];const result=await compose(source,config);assert.equal(result.products[0].rules.length,2);assert.equal(result.products[0].rules[1].cards,true);
  assert.equal(safeUrl('javascript:alert(1)'),'');assert.equal(safeUrl('http://a.test'),'');
});
test('bad columns, duplicate resource, team mismatch fail closed',async()=>{
  for(const mutate of [x=>{x.catalog=[['wrong']];},x=>{x.documents.teamId='other';},x=>{x.team.resources=[{key:'a',season:config.season},{key:'a',season:config.season}];}]){
    const source=input();mutate(source);await assert.rejects(()=>compose(source,config));
  }
});
test('chunked collaboration format verified before parse',()=>{
  const s=JSON.stringify({documents:[]});assert.deepEqual(decodeTeam([['collaboration-v1:2'],['J'+s.slice(0,5)],['J'+s.slice(5)]]),{documents:[]});
  assert.throws(()=>decodeTeam([['collaboration-v1:2'],['J{}']]));
});
test('baseline creates no old notifications; repeated snapshot no events',async()=>{
  const a=await compose(input(),config,'2026-11-01T01:00:00Z');assert.deepEqual(await changes(null,a),[]);assert.deepEqual(await changes(a,a),[]);
  const source=input();source.responses.push(['new','新顧客','new@example.com','0911111111','',1]);const b=await compose(source,config,'2026-11-01T01:05:00Z');const events=await changes(a,b);assert.equal(events.filter(e=>e.type==='order').length,1);assert.equal(JSON.stringify(events).includes('new@example.com'),false);
});
test('inventory includes history and finance only selected season',()=>{
  const value=ledger(input().ledger,config.season);assert.equal(value.stock.get('遊戲甲'),2);assert.equal(value.income,100);assert.equal(value.cost,0);
});
