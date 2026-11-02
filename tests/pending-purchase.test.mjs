import test from 'node:test';import assert from 'node:assert/strict';
import {awaitingPurchase} from '../public/order-followup.js';
const line=(purchased,quantity=2,evidence='confirmed')=>({purchased,quantity,evidence:{purchased:evidence}});
test('awaiting purchase excludes rules-only, unknown and conflict records',()=>{
 assert(awaitingPurchase({lines:[line(0)]}));assert(awaitingPurchase({lines:[line(1)]}));
 assert.equal(awaitingPurchase({lines:[line(2)]}),false);
 assert.equal(awaitingPurchase({lines:[line(null,2,'missing')]}),false);
 assert.equal(awaitingPurchase({lines:[line(1,2,'shipment')]}),false);
 assert.equal(awaitingPurchase({lines:[line(0,2,'conflict')]}),false);
 assert.equal(awaitingPurchase({issues:['來源不一致'],lines:[line(0)]}),false);
 assert.equal(awaitingPurchase({lines:[line(0),line(2,2,'conflict')]}),false);
 assert.equal(awaitingPurchase({lines:[line(0),line(2,2,'processing')]}),false);
});
