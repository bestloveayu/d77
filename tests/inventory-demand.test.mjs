import test from 'node:test';
import assert from 'node:assert/strict';
import {compose, ledger, digest, changes} from '../worker/model.mjs';

const config={season:'2026秋',spreadsheetId:'book',responseSheet:'responses'};
const headers=['品項','增減數量','東收入','于收入','東支出','于支出','季別','時間戳記'];
const entry=(name,q,at,season='2026秋')=>[name,q,0,0,0,0,season,at];
const input=()=>({catalog:[['中文名稱','訂購量'],['北海',18]],responses:[['姓名','【北海】100元'],['客人',18]],ledger:[headers,entry('北海',14,'2026/11/1 上午 8:00')],team:{teamId:'t',resources:[],operations:[]},documents:{teamId:'t',documents:[]},rules:[]});

test('no ledger shipment means zero shipped and exact demand',async()=>{
  const snapshot=await compose(input(),config),p=snapshot.products[0];
  assert.equal(p.shipped,0);assert.equal(p.outstanding,18);
  assert.equal(p.shortage,4);assert.equal(p.shortageEstimate,false);
  assert.equal(snapshot.summary.shortages,1);assert.equal(snapshot.inventoryVersion,3);
});
test('collaboration alone does not count as ledger shipment',async()=>{
  const source=input(),origin=['2026秋','book','responses',2,1];
  source.team.resources=[{season:config.season,key:await digest(['shipment',...origin,'']),fingerprint:await digest([origin,'北海',18]),doneQuantity:4}];
  const p=(await compose(source,config)).products[0];
  assert.equal(p.shipped,0);assert.equal(p.outstanding,18);assert.equal(p.shortage,4);assert.equal(p.shortageEstimate,false);
});
test('mismatched response totals retain authoritative catalog demand',async()=>{
  const source=input();source.responses[1][1]=2;
  const p=(await compose(source,config)).products[0];
  assert.equal(p.orderQuantityMismatch,true);assert.equal(p.outstanding,18);assert.equal(p.shortage,4);assert.equal(p.shortageEstimate,false);
});
test('unknown response quantity does not invalidate valid catalog demand',async()=>{
  const source=input();source.responses[1][1]='待核對';
  let p=(await compose(source,config)).products[0];
  assert.equal(p.responseOrdered,null);assert.equal(p.shipped,0);assert.equal(p.outstanding,18);assert.equal(p.shortage,4);
  source.catalog[1][1]='待核對';p=(await compose(source,config)).products[0];
  assert.equal(p.ordered,null);assert.equal(p.shortage,null);assert.equal(p.shortageEstimate,false);
});
test('stock updates span seasons and used names, ignore cash zero and invalid quantities',async()=>{
  const source=input();source.ledger=[headers,
    entry('北海',10,'2026/11/2 上午 12:30','2025秋'),
    entry('北海',4,'2026/11/1 下午 11:59'),
    entry('北海（二手）',2,'2026/11/2 下午 12:30','2025秋'),
    entry('北海',0,'2026/12/1 上午 9:00'),
    entry('北海','待核對','2026/12/2 上午 9:00'),
    entry('北海（二手）',1,'2026-11-02T04:30:00Z'),
    entry('北海',1,'not a date')];
  const value=ledger(source.ledger,config.season);
  assert.deepEqual(value.stockUpdates.get('北海'),{time:Date.parse('2026-11-01T16:30:00Z'),at:'2026/11/2 上午 12:30',row:2});
  const p=(await compose(source,config)).products[0];
  assert.equal(value.stock.get('北海'),15);
  assert.equal(p.stock,null);assert.equal(p.shortage,null);assert.equal(p.coverage,'unknown');assert.equal(p.usedStock,3);
  assert.equal(p.stockUpdatedTime,Date.parse('2026-11-02T04:30:00Z'));
  assert.equal(p.stockUpdatedAt,'2026-11-02T04:30:00Z');assert.equal(p.stockUpdatedRow,7);
});
test('undated updates are retained after dated updates; date-only and English AM/PM use Taiwan time',()=>{
  const rows=[headers,entry('a',1,'bad'),entry('a',1,''),entry('b',1,'2026-11-02'),entry('c',1,'11/2/2026 12:30 AM'),entry('d',1,'2026/11/2 12:30 PM'),entry('b',1,'2026/02/30')];
  const updates=ledger(rows,config.season).stockUpdates;
  assert.deepEqual(updates.get('a'),{time:null,at:'',row:3});
  assert.equal(updates.get('b').time,Date.parse('2026-11-01T16:00:00Z'));
  assert.equal(updates.get('c').time,Date.parse('2026-11-01T16:30:00Z'));
  assert.equal(updates.get('d').time,Date.parse('2026-11-02T04:30:00Z'));
});
test('inventory migration is silent and subsequent ledger shortage changes notify',async()=>{
  const next=await compose(input(),config),previous=structuredClone(next);
  delete previous.inventoryVersion;previous.products[0].shortage=null;
  assert.deepEqual(await changes(previous,next),[]);
  previous.inventoryVersion=2;assert.deepEqual(await changes(previous,next),[]);
  previous.inventoryVersion=3;
  const events=await changes(previous,next);
  assert.equal(events.length,1);assert.equal(events[0].title,'庫存不足提醒');assert.match(events[0].detail,/尚缺 4/);
  next.products[0].shortageEstimate=false;delete previous.inventoryVersion;
  const confirmed=await changes(previous,next);assert.equal(confirmed.length,0);
});
