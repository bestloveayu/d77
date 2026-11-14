import test from 'node:test';
import assert from 'node:assert/strict';
import {changes} from '../worker/model.mjs';
import {widgetSummary} from '../worker/widget.mjs';
const order={id:'o',name:'陳元笙',lines:[{name:'遊戲甲',originalName:'遊戲甲',quantity:1,price:990,purchased:0,shipped:0,mailed:0}],total:990};
const product={name:'遊戲甲',shortage:2,stock:0,rules:[]};
const before={season:'2026秋',updatedAt:'2026-11-12T01:00:00Z',orders:[],products:[product],operations:[],transactions:[],inventoryVersion:3,stockCalculationVersion:1};
test('new orders include customer and products and retrigger shortage even without quantity change',async()=>{
 const next={...before,updatedAt:'2026-11-12T02:00:00Z',orders:[order]};const events=await changes(before,next);
 assert.equal(events.find(e=>e.type==='order').title,'陳元笙 新增預購');
 assert.match(events.find(e=>e.type==='order').detail,/遊戲甲/);
 assert.equal(events.filter(e=>e.type==='shortage').length,1);assert.equal(events.find(e=>e.type==='shortage').title,'遊戲甲 庫存不足');
 const out=widgetSummary(next,events);assert.match(out.events.find(e=>e.title.includes('新增預購')).body,/遊戲甲/);assert(!out.events.find(e=>e.title.includes('新增預購')).body.includes('990'));
});
test('shipment and mail identify actors while widget mail only lists items',async()=>{
 const prior={...before,orders:[order]};const next={...prior,orders:[{...order,lines:[{...order.lines[0],shipped:1,mailed:1,actionActors:{shipped:'小東',mailed:'于正'}}]}]};
 const events=await changes(prior,next);
 assert.equal(events.find(e=>e.type==='shipment').detail,'小東登記');
 assert.equal(events.find(e=>e.type==='mail').detail,'于正寄送');
 const body=widgetSummary(next,events).events.find(e=>e.title.includes('規則已寄送')).body;assert.match(body,/遊戲甲/);assert(!body.includes('990'));assert(!body.includes('合計'));
});
test('widget shows signed incoming and outgoing stock movements',()=>{
 const transactions=[{id:'sale',kind:'銷貨收入',quantity:-1,name:'遊戲甲'},{id:'buy',kind:'進貨成本',quantity:1,name:'遊戲甲',amount:100}];
 const out=widgetSummary({...before,transactions},transactions.map(t=>({type:'stock',target:{transactionId:t.id}})));
 assert.equal(out.events.length,2);assert.match(out.events[0].body,/−1/);assert.match(out.events[1].body,/\+1/);
});
