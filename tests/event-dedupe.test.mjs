import test from 'node:test';
import assert from 'node:assert/strict';
import {dedupeEvents} from '../worker/event-dedupe.mjs';
import {widgetSummary} from '../worker/widget.mjs';
const e=(type,id)=>({id,type,time:'2026-11-15T03:35:00Z',target:{id:'customer'},widgetFacts:{body:'甲 ×1（$100）；合計 $100'}});
test('paired sources show one registration with original ids retained and no source mutation',()=>{
 const events=[e('purchase','a'),e('registration','b')],before=JSON.stringify(events),out=dedupeEvents(events);
 assert.equal(out.length,1);assert.equal(out[0].type,'registration');assert.deepEqual(out[0].relatedEventIds,['a','b']);assert.equal(JSON.stringify(events),before);
 assert.equal(dedupeEvents([...events].reverse())[0].id,'b');
 const widget=widgetSummary({orders:[],products:[],transactions:[]},events);
 assert.equal(widget.events.length,1);assert.equal(widget.events[0].type,'registration');
});
test('same customer later orders, different order ids and changed items remain separate',()=>{
 const a=e('purchase','a'),b=e('registration','b');
 for(const change of [{time:'2026-11-15T03:40:00Z'},{target:{id:'other'}},{widgetFacts:{body:'乙 ×2'}}])assert.equal(dedupeEvents([a,{...b,...change}]).length,2);
 assert.equal(dedupeEvents([a,{...a,id:'next'}]).length,2);
});
