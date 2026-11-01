import test from 'node:test';import assert from 'node:assert/strict';
import {stageLabel,orderProgressLabels} from '../public/order-status.js';
test('missing, conflict, processing and confirmed zero have distinct labels',()=>{
  assert.equal(stageLabel({shipped:null,evidence:{shipped:'missing'}},'shipped'),'出貨尚無雲端紀錄');
  assert.equal(stageLabel({shipped:0,quantity:2,evidence:{shipped:'confirmed'}},'shipped'),'尚未出貨 0/2');
  assert.equal(stageLabel({shipped:null,evidence:{shipped:'conflict'}},'shipped'),'出貨來源不一致待核對');
  assert.equal(stageLabel({shipped:0,evidence:{shipped:'processing'}},'shipped'),'出貨處理中');
  const labels=orderProgressLabels({progress:{total:2,purchased:1,shipped:0,mailed:0,ruleTotal:1,purchaseUnknown:1,shipmentUnknown:1,mailUnknown:1}});
  assert(labels.every(x=>x.text.includes('部分無紀錄')));assert(labels.every(x=>!x.good));
});

