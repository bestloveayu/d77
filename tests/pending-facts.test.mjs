import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingFacts} from '../worker/widget-facts.mjs';
import {changes} from '../worker/model.mjs';
import {displayEvent} from '../worker/notification-display.mjs';
import {widgetSummary} from '../worker/widget.mjs';
const lines=[{name:'北海',originalName:'北海',quantity:2,purchased:2,shipped:1,price:1290,mailed:0},{name:'牌架日本',originalName:'牌架日本',quantity:2,purchased:2,shipped:0,price:620,mailed:0}];
const order={id:'o',name:'王小明',lines,followUp:{kind:'registration'}};
test('pending shipment lists remaining purchased quantities, subtotals and total',()=>{
 const facts=pendingFacts(order,'registration');
 assert.equal(facts.title,'王小明 已下單待出貨');
 assert.equal(facts.body,'北海 ×1（$1,290）、牌架日本 ×2（$1,240）；合計 $2,530');
});
test('pending rules excludes unsent, exempt and already mailed items and all amounts',()=>{
 const facts=pendingFacts({...order,lines:[...lines,{...lines[0],name:'免寄',noRulesRequired:true},{...lines[0],name:'已寄',mailed:1}]},'rules-pending');
 assert.equal(facts.title,'王小明 已出貨待寄規則');assert.equal(facts.body,'北海');
});
test('one purchase transition produces only one actionable reminder, frozen across channels',async()=>{
 const s={season:'2026秋',updatedAt:'2026-11-15T00:00:00Z',followUpVersion:2,products:[],operations:[],transactions:[]};
 const old={...s,orders:[{...order,lines:lines.map(l=>({...l,purchased:0,shipped:0})),followUp:{kind:'none'}}]};
 const next={...s,orders:[order]};
 const events=await changes(old,next),pending=events.filter(e=>['purchase','registration'].includes(e.type));
 assert.equal(pending.length,1);assert.equal(pending[0].type,'registration');
 const after={...next,orders:[{...order,lines:lines.map(l=>({...l,shipped:l.quantity}))}]};
 assert.equal(displayEvent(pending[0],after).detail,pending[0].detail);
 assert.equal(widgetSummary(after,pending).events[0].body,pending[0].detail);
 assert.equal((await changes(next,next)).length,0);
});
