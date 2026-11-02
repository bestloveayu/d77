import test from 'node:test';import assert from 'node:assert/strict';
import {awaitingPurchase} from '../public/order-followup.js';
const line=(purchased,quantity=2,evidence='confirmed')=>({purchased,quantity,evidence:{purchased:evidence}});
test('awaiting purchase follows zero confirmed purchase total, not incomplete quantities',()=>{
 assert(awaitingPurchase({lines:[line(0)]}));assert.equal(awaitingPurchase({lines:[line(1)]}),false);
 assert.equal(awaitingPurchase({lines:[line(2)]}),false);
 assert.equal(awaitingPurchase({lines:[line(null,2,'missing')]}),true);
 assert.equal(awaitingPurchase({lines:[line(1,2,'shipment')]}),false);
 assert.equal(awaitingPurchase({lines:[line(0,2,'conflict')]}),false);
 assert.equal(awaitingPurchase({issues:['來源不一致'],lines:[line(0)]}),false);
 assert.equal(awaitingPurchase({lines:[line(0),line(2,2,'conflict')]}),false);
 assert.equal(awaitingPurchase({lines:[line(0),line(2,2,'processing')]}),false);
 assert.equal(awaitingPurchase({lines:[line(0),line(1)]}),false);
 assert.equal(awaitingPurchase({progress:{purchased:0},lines:[line(null,2,'missing')]}),true);
 assert.equal(awaitingPurchase({progress:{purchased:1},lines:[line(0)]}),false);
 assert.equal(awaitingPurchase({lines:[]}),false);
});
