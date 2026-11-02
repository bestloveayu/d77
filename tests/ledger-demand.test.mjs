import test from 'node:test';
import assert from 'node:assert/strict';
import {compose,digest,ledger,changes} from '../worker/model.mjs';
const config={season:'fall',responseSheet:'r',spreadsheetId:'b'};
const row=(q,note='GM/銷貨收入',name='Game',season='fall')=>[name,q,0,0,0,0,season,note];
const source=(rows=[])=>({catalog:[['中文名稱','訂購量'],['Game',10]],responses:[['姓名','【Game】100元'],['Customer',10]],ledger:[['品項','增減數量','東收入','于收入','東支出','于支出','季別','備註'],row(10,'GM/進貨'),...rows],team:{teamId:'t',resources:[],operations:[]},documents:{teamId:'t',documents:[]}});
test('canonical stock and latest update use aliases across history without changing raw ledger',async()=>{
  const s=source([row(-2,'GM/出貨','Alias')]);s.ledger[1][1]=8;
  s.ledger[0].push('時間戳記');s.ledger[1].push('2026-11-01');s.ledger[2].push('2026-11-02');
  const p=(await compose(s,{...config,aliases:{Alias:'Game'}})).products[0];
  assert.equal(p.stock,6);assert.equal(p.shipped,2);assert.equal(p.outstanding,8);assert.equal(p.shortage,2);assert.equal(p.stockUpdatedRow,3);
  const raw=ledger(s.ledger,'fall');assert.equal(raw.stock.get('Game'),8);assert.equal(raw.stock.get('Alias'),-2);
  s.ledger[2][0]=' g A m E ';assert.equal((await compose(s,config)).products[0].stock,6);
});
test('literal game name containing 二手 stays new unless it has a parenthesized used suffix',async()=>{
  const s=source([row(-2,'GM/出貨','二手市場')]);
  s.catalog[1][0]='二手市場';s.responses[0][1]='【二手市場】100元';s.ledger[1][0]='二手市場';
  let result=await compose(s,config),p=result.products[0];
  assert.equal(p.stock,8);assert.equal(p.shipped,2);assert.equal(p.usedShipped,0);assert.equal(p.usedStock,0);
  assert.deepEqual(result.unmatchedShipments,[]);
  s.ledger.push(row(3,'GM/進貨','二手市場(二手)'),row(-1,'GM/出貨','二手市場（二手）  '));
  result=await compose(s,config);p=result.products[0];
  assert.equal(p.stock,8);assert.equal(p.shipped,2);assert.equal(p.usedStock,2);assert.equal(p.usedShipped,1);
});
test('all-history invalid stock quantities taint only their canonical stock side',async()=>{
  for(const q of [null,'bad',10.5])for(const used of [false,true]){
    const s=source([row(q,'GM/進貨',used?'Alias（二手）':'Alias','spring')]);
    s.catalog=[['中文名稱','訂購量','二手訂購量'],['Game',10,3],['Other',1,1]];
    const result=await compose(s,{...config,aliases:{Alias:'Game'}}),p=result.products[0];
    assert.equal(used?p.usedShortage:p.shortage,null);assert.equal(p.coverage,'unknown');
    assert.equal(used?p.shortage:p.usedShortage,used?0:3);
    assert.equal(result.products[1].coverage,'confirmed');
    assert.ok(ledger(s.ledger,'fall').invalidStockQuantities.has(used?'Alias（二手）':'Alias'));
  }
});
test('unmatched nonzero sales expose reconciliation rows without invalidating unrelated products',async()=>{
  for(const name of ['Gmae','', 'Gmae（二手）']){
    const result=await compose(source([row(-1,'GM/出貨',name)]),config);
    assert.deepEqual(result.unmatchedShipments,[{sourceRow:3,name,quantity:-1,used:name.includes('二手'),reason:'unmatched'}]);
    assert.equal(result.summary.unmatchedShipments,1);assert.equal(result.products[0].shipped,0);assert.equal(result.products[0].coverage,'confirmed');
  }
  const cash=await compose(source([row(0,'GM/出貨','bad name')]),config);
  assert.deepEqual(cash.unmatchedShipments,[]);assert.equal(cash.summary.unmatchedShipments,0);assert.deepEqual(cash.issues,[]);
});
test('canonical stock migration silently baselines old snapshots then future shortages notify',async()=>{
  const next=await compose(source(),config),old=structuredClone(next);delete old.stockCalculationVersion;
  old.products[0].shortage=0;next.products[0].shortage=2;
  assert.deepEqual(await changes(old,next),[]);
  old.stockCalculationVersion=next.stockCalculationVersion;
  assert.equal((await changes(old,next)).filter(e=>e.type==='shortage').length,1);
});
test('ledger sales alone reduce outstanding without double subtraction of stock',async()=>{
  const s=await compose(source([row(-2)]),config),p=s.products[0];
  assert.equal(p.stock,8);assert.equal(p.shipped,2);assert.equal(p.outstanding,8);assert.equal(p.shortage,0);assert.equal(p.coverage,'confirmed');assert.equal(p.shipmentSource,'ledger');
});
test('used, general and other-season sales are not new GM demand',async()=>{
  const s=await compose(source([row(-2),row(-1,'GM/出貨','Game（二手）'),row(-1,'一般販售/銷貨收入'),row(-1,'GM/出貨','Game','spring')]),config);
  assert.equal(s.products[0].shipped,2);assert.equal(s.products[0].usedShipped,1);assert.equal(s.products[0].stock,6);assert.equal(s.products[0].usedOutstanding,null);assert.equal(s.transactions[2].salesChannel,'gm');
});
test('positive corrections reduce shipped, cash-only rows do not',async()=>{
  const p=(await compose(source([row(-3),row(1),row(0)]),config)).products[0];assert.equal(p.shipped,2);
});
test('invalid, negative-net and overshipped demand stays unknown',async()=>{
  for(const q of ['bad',1,-11]){const p=(await compose(source([row(q)]),config)).products[0];assert.equal(p.shipped,null);assert.equal(p.shortage,null);assert.equal(p.shortageEstimate,false);assert.equal(p.coverage,'unknown');}
});
test('ambiguous foreign name invalidates each candidate',async()=>{
  const s=source([row(-1,'GM/出貨','Shared')]);s.catalog=[['中文名稱','外文名稱','訂購量'],['Game','Shared',10],['Other','Shared',1]];
  const result=await compose(s,config);assert.ok(result.products.every(p=>p.shipped===null));
});
test('collaboration shipment remains order-only and never doubles ledger shipment',async()=>{
  const s=source([row(-2)]),origin=['fall','b','r',2,1];
  s.team.resources=[{season:'fall',key:await digest(['shipment',...origin,'']),fingerprint:await digest([origin,'Game',10]),doneQuantity:2}];
  const result=await compose(s,config);
  assert.equal(result.orders[0].lines[0].shipped,2);assert.equal(result.products[0].shipped,2);assert.equal(result.products[0].shortage,0);
});
test('legacy unknown channel and used aliases resolve without changing finance',async()=>{
  const s=source([row(-2,'出貨','Alias'),row(-1,'GM/出貨','Alias（二手）')]);
  s.ledger[2][2]=200;s.ledger[3][3]=50;
  const result=await compose(s,{...config,aliases:{Alias:'Game'}}),p=result.products[0];
  assert.equal(p.shipped,2);assert.equal(p.usedShipped,1);assert.equal(result.transactions[1].salesChannel,'unknown');
  assert.ok(result.issues.some(i=>i.includes('未標示通路')));
  assert.deepEqual(result.finance,{income:250,cost:0,profit:250,eastDue:75});
});
test('explicit cloud used demand calculates independently from new demand',async()=>{
  const s=source([row(3,'GM/進貨','Game（二手）'),row(-1,'GM/出貨','Game（二手）')]);
  s.catalog=[['中文名稱','訂購量','二手訂購量'],['Game',10,3]];
  const p=(await compose(s,config)).products[0];
  assert.equal(p.usedOrdered,3);assert.equal(p.usedStock,2);assert.equal(p.usedShipped,1);
  assert.equal(p.usedOutstanding,2);assert.equal(p.usedShortage,0);
  assert.equal(p.shipped,0);assert.equal(p.outstanding,10);assert.equal(p.shortage,0);
});
test('summary counts products with either shortage once without combining quantities',async()=>{
  const s=source([row(1,'GM/進貨','Game（二手）')]);
  s.catalog=[['中文名稱','訂購量','二手訂購量'],['Game',10,3]];
  const result=await compose(s,config),p=result.products[0];
  assert.equal(p.shortage,0);assert.equal(p.usedShortage,2);assert.equal(result.summary.shortages,1);
  s.catalog[1][1]=12;
  const both=await compose(s,config);
  assert.equal(both.products[0].shortage,2);assert.equal(both.products[0].usedShortage,2);
  assert.equal(both.summary.shortages,1);
});
test('missing or invalid used demand never inherits new demand',async()=>{
  for(const value of [undefined,'','bad',-1,1.5]){
    const s=source([row(-1,'GM/出貨','Game（二手）')]);
    if(value!==undefined)s.catalog=[['中文名稱','訂購量','二手訂購量'],['Game',10,value]];
    const p=(await compose(s,config)).products[0];
    assert.equal(p.usedOrdered,null);assert.equal(p.usedShipped,1);
    assert.equal(p.usedOutstanding,null);assert.equal(p.usedShortage,null);assert.equal(p.coverage,'confirmed');
  }
});
test('invalid, negative-net or excessive used shipments invalidate only used calculations',async()=>{
  for(const q of ['bad',1,-4]){
    const s=source([row(q,'GM/銷貨收入','Game（二手）')]);
    s.catalog=[['中文名稱','訂購量','二手訂購量'],['Game',10,3]];
    const p=(await compose(s,config)).products[0];
    assert.equal(p.usedOrdered,3);assert.equal(p.usedShipped,null);
    assert.equal(p.usedOutstanding,null);assert.equal(p.usedShortage,null);
    assert.equal(p.shipped,0);assert.equal(p.shortage,0);assert.equal(p.coverage,'unknown');
  }
});
