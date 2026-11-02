import test from 'node:test';
import assert from 'node:assert/strict';
test('catalog ordered quantity is authoritative and unmatched demand cannot look fully shipped',async()=>{
  const source=input();source.catalog[1][0]='十三鬼狩隊';source.catalog[1][3]=6;
  source.responses[0][5]='【十三鬼狩】2人，890元 [請勾選數量]';
  const p=(await compose(source,config)).products[0];
  assert.equal(p.ordered,6);assert.equal(p.responseOrdered,0);
  assert.equal(p.orderQuantityMismatch,true);assert.equal(p.shipped,0);assert.equal(p.outstanding,6);assert.equal(p.shortage,6);assert.equal(p.shortageEstimate,false);
});
test('manual wish quantities in catalog survive a zero form count',async()=>{
  const source=input();source.responses=[source.responses[0]];source.catalog[1][3]=1;
  const p=(await compose(source,config)).products[0];assert.equal(p.ordered,1);assert.equal(p.outstanding,0);
});
test('local form prefix normalization binds cloud shipment and proves purchase without guessing missing records',async()=>{
  const source=input();source.responses[0][5]='2026GM [R.遊戲甲 2-3人：100元]';
  const origin=['2026秋','book',config.responseSheet,2,5];
  source.team.resources=[{key:await digest(['shipment',...origin,'']),fingerprint:await digest([origin,'遊戲甲',2]),doneQuantity:2,season:'2026秋'}];
  const result=await compose(source,config);const order=result.orders[0];
  assert.equal(order.lines[0].shipped,2);assert.equal(order.lines[0].purchased,2);
  assert.equal(order.progress.shipped,2);assert.equal(order.status,'已出貨');
  const missing=await compose(input(),config);
  assert.equal(missing.orders[0].status,'尚無雲端操作紀錄');
  assert.equal(missing.orders[0].lines[0].evidence.shipped,'missing');
});
test('source conflicts and active operations remain distinct and do not inherit done quantities',async()=>{
  const source=input();const origin=['2026秋','book',config.responseSheet,2,5];
  source.team.resources=[{key:await digest(['shipment',...origin,'']),fingerprint:'different',doneQuantity:2,season:'2026秋'}];
  const conflict=(await compose(source,config)).orders[0];
  assert.equal(conflict.status,'來源不一致待核對');assert.equal(conflict.lines[0].shipped,null);
  source.team.resources[0]={...source.team.resources[0],fingerprint:await digest([origin,'A遊戲甲',2]),doneQuantity:0,activeOperationId:'in-flight'};
  const active=(await compose(source,config)).orders[0];
  assert.equal(active.lines[0].evidence.shipped,'processing');assert.equal(active.status,'雲端處理中');
});
test('season account difference follows payer columns and settlement direction',()=>{
  const h=['品項','增減數量','東收入','于收入','東支出','于支出','季別','結餘(東給于)'];
  const rows=[h,['',0,1000,200,400,600,'2026秋',100],['',0,9999,0,0,0,'2026春',0]];
  assert.equal(ledger(rows,'2026秋').eastDue,400);
  assert.equal(ledger([h,['',0,0,1000,0,0,'2026秋',0]],'2026秋').eastDue,-500);
  assert.equal(ledger([h,['',0,0,0,0,0,'2026秋','待核對']],'2026秋').eastDue,null);
});
test('cash totals are independent of invalid stock quantities and use local currency formatting',()=>{
  const rows=[['品項','增減數量','東收入','于收入','東支出','于支出','季別'],['遊戲甲','待核對','NT$ 1,200元','', '', '$300','2026秋']];
  const result=ledger(rows,'2026秋');
  assert.equal(result.income,1200);assert.equal(result.cost,300);
  assert.equal(result.stock.has('遊戲甲'),false);
  assert.equal(result.issues.length,1);
});
test('form quantity prompt is not a product name and full title price is retained',async()=>{
  const rows=[['真實姓名','【遊戲甲】3〜5人，750元 [請勾選數量]'],['測試顧客',2]];
  const result=await parseResponses(rows,config,[{name:'遊戲甲',price:800}]);
  assert.equal(result[0].lines[0].name,'遊戲甲');
  assert.equal(result[0].lines[0].price,750);
  assert.equal(result[0].lines[0].mapped,true);
});
test('matrix options retain their own name and price rather than the shared question title',async()=>{
  const rows=[['真實姓名','【系列】 [【遊戲乙】2人，490元]','【組合】1490元 [單獨擴充]'],['測試顧客',1,1]];
  const result=await parseResponses(rows,config,[{name:'遊戲乙',price:490},{name:'單獨擴充',price:599}]);
  assert.deepEqual(result[0].lines.map(x=>[x.name,x.price]),[['遊戲乙',490],['單獨擴充',599]]);
});
import {compose,changes,decodeTeam,digest,safeUrl,parseResponses,catalog,ledger} from '../worker/model.mjs';
const config={season:'2026秋',spreadsheetId:'book',responseSheet:'2026秋預購回應',aliases:{'A遊戲甲':'遊戲甲'}};
const input=()=>({catalog:[['中文名稱','外文名稱','代購(台)','訂購量','預約量','攤位','規則書'],['遊戲甲','Game A',100,2,3,'57','']],
  responses:[['時間戳記','真實姓名','電子郵件地址','手機號碼','FB暱稱','2026GM [A遊戲甲 2-3人：100元]'],['2026/11/1 上午 8:00','測試本名','test@example.com','0912345678','小測試',2]],
  ledger:[['品項','增減數量','東收入','于收入','東支出','于支出','季別'],['遊戲甲',3,'','','',300,'2025秋'],['遊戲甲',-1,100,'','','','2026秋']],
  team:{teamId:'team',resources:[],operations:[]},documents:{teamId:'team',documents:[]},rules:[]});
test('ledger shipment is known without collaboration; contacts not exposed; explicit alias resolves name',async()=>{
  const result=await compose(input(),config);
  assert.equal(result.orders[0].name,'測試本名');assert.equal(result.orders[0].email,undefined);assert.equal(result.orders[0].phone,undefined);
  assert.equal(result.products[0].stock,2);assert.equal(result.products[0].shortage,0);assert.equal(result.products[0].shortageEstimate,false);
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
  const result=await compose(source,config);assert.equal(result.orders[0].status,'來源不一致待核對');assert.equal(result.orders[0].lines[0].shipped,null);
});
test('manual tombstones excluded and stable manual line IDs used',async()=>{
  const source=input();source.documents.documents=[{kind:'manualOrder',season:'2026秋',id:'removed',deleted:true,body:{}},{kind:'manualOrder',season:'2026秋',id:'a'.repeat(32),deleted:false,body:{name:'手動顧客',items:[{name:'遊戲甲',quantity:1,unitPrice:100,localLineId:'b'.repeat(32)}]}}];
  const result=await compose(source,config);assert.equal(result.orders.length,2);assert.equal(result.orders[1].manual,true);
});
test('invalid quantities not silently ignored',async()=>{
  const source=input();source.responses[1][5]='我要兩盒';const result=await compose(source,config);assert.equal(result.orders[0].total,null);assert.equal(result.products[0].ordered,2);assert.equal(result.products[0].responseOrdered,null);assert.equal(result.products[0].outstanding,1);
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
