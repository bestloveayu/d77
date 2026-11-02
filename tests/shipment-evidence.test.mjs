import test from 'node:test';
import assert from 'node:assert/strict';
import {compose,changes} from '../worker/model.mjs';
const config={season:'fall',spreadsheetId:'book',responseSheet:'responses',aliases:{Alias:'Game'}};
const headers=['品項','增減數量','東收入','于收入','東支出','于支出','季別','備註','交易編號'];
const row=(name,q,note='GM/銷貨收入',season='fall')=>[name,q,0,0,0,0,season,note,'same-id'];
const source=rows=>({catalog:[['中文名稱','外文名稱','訂購量'],['Game','Shared',10]],responses:[['姓名','【Game】100元'],['Customer',10]],ledger:[headers,...rows],team:{teamId:'t',resources:[],operations:[]},documents:{teamId:'t',documents:[]}});
test('shipment evidence retains exact accepted row IDs including corrections and aliases',async()=>{
  const result=await compose(source([
    row('Game',10,'GM/進貨'),row('Game',-2),row('Alias',-1,'出貨'),row('Game',1),
    row('Game（二手）',-1),row('Game',-1,'一般/出貨'),row('Game',-1,'GM/出貨','spring'),row('Game',0),
  ]),config),p=result.products[0];
  assert.equal(result.ledgerDetailVersion,1);
  assert.deepEqual(p.shipmentTransactionIds,['row-3','row-4','row-5']);
  assert.deepEqual(p.usedShipmentTransactionIds,['row-6']);
  const evidence=result.transactions.filter(tx=>p.shipmentTransactionIds.includes(tx.id));
  assert.equal(evidence.length,3);assert.equal(new Set(p.shipmentTransactionIds).size,3);
  assert.equal(evidence.reduce((sum,tx)=>sum-tx.quantity,0),p.shipped);assert.equal(p.shipped,2);
  assert.equal(new Set(evidence.map(tx=>tx.transactionId)).size,1);
  const previous=structuredClone(result);delete previous.ledgerDetailVersion;
  for(const product of previous.products){delete product.shipmentTransactionIds;delete product.usedShipmentTransactionIds;}
  assert.deepEqual(await changes(previous,result),[]);
});
test('invalid unique sales retain evidence but ambiguous and unmatched rows claim no adoption',async()=>{
  const s=source([row('Alias','bad'),row('Shared',-1),row('Missing',-1)]);
  s.catalog.push(['Other','Shared',2]);
  const result=await compose(s,config);
  assert.deepEqual(result.products[0].shipmentTransactionIds,['row-2']);assert.equal(result.products[0].shipped,null);
  assert.deepEqual(result.products[1].shipmentTransactionIds,[]);
  assert.ok(result.products.every(p=>p.usedShipmentTransactionIds.length===0));
  assert.equal(result.unmatchedShipments.length,2);
});
