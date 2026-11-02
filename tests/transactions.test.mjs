import test from 'node:test';
import assert from 'node:assert/strict';
import {ledger} from '../worker/model.mjs';
const h=['品項','增減數量','東收入','于收入','東支出','于支出','季別','備註','交易編號','時間戳記','結餘(東給于)'];
test('transaction rows retain selected season, old and new type labels and source evidence',()=>{
  const result=ledger([h,['甲',-1,100,0,0,0,'2026秋','GM / 出貨 / 客人','tx','2026/11/1',0],['乙',1,0,0,0,40,'2026秋','一般 / 進貨成本','','2026/11/2',0],['',0,0,0,0,20,'2026秋','GM / 其他支出 / 住宿','','',0],['',0,0,0,0,0,'2026春','結算','','',50]],'2026秋');
  assert.equal(result.transactions.length,3);
  assert.deepEqual(result.transactions.map(t=>t.kind),['銷貨收入','進貨成本','其他成本']);
  assert.equal(result.transactions[0].subject,'客人');
  assert.equal(result.transactions[0].transactionId,'tx');
  assert.equal(result.transactions[1].actor,'于正');
  assert.equal(result.transactions[2].subject,'住宿');
  assert.equal(result.income,100);assert.equal(result.cost,60);
});
test('missing transaction IDs remain separate and invalid amounts stay unknown',()=>{
  const rows=[h,['',0,'bad',0,0,0,'2026秋','其他收入','','',0],['',0,5,0,0,0,'2026秋','其他收入','','',0]];
  const r=ledger(rows,'2026秋');assert.equal(r.transactions.length,2);
  assert.notEqual(r.transactions[0].id,r.transactions[1].id);assert.equal(r.transactions[0].amount,null);
});
test('cashByPerson preserves each payer column with blank zero and invalid null',()=>{
  const result=ledger([h,
    ['Game',-1,100,25,5,10,'2026秋','GM/出貨'],
    ['Game',0,'','bad','bad','','2026秋','其他收入'],
  ],'2026秋');
  assert.deepEqual(result.transactions[0].cashByPerson,{east:{income:100,cost:5},yu:{income:25,cost:10}});
  assert.deepEqual(result.transactions[1].cashByPerson,{east:{income:0,cost:null},yu:{income:null,cost:0}});
  assert.equal(result.income,125);assert.equal(result.cost,15);assert.equal(result.eastDue,null);
});
