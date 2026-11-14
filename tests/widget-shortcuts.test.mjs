import test from 'node:test';
import assert from 'node:assert/strict';
import {widgetSummary} from '../worker/widget.mjs';
test('widget projects only verified order/product targets without contacts',()=>{
 const snapshot={season:'2026秋',orders:[{id:'a',name:'甲',email:'private@example.com',lines:[],followUp:{kind:'rules'}}],products:[{name:'遊戲甲',rules:[],shortage:1,stock:0}],transactions:[]};
 const result=widgetSummary(snapshot,[{id:'e',type:'rules',target:{name:'遊戲甲'},time:'2026-11-14T00:00:00Z'},{id:'f',type:'order',target:{id:'a'},time:'2026-11-14T00:00:00Z'},{id:'bad',type:'order',target:{id:'not-an-order'}}]);
 assert.equal(result.events[0].target.name,'遊戲甲');assert.equal(result.events[1].target.id,'a');assert.equal(result.events[2].target,undefined);
 assert.ok(result.todos.some(t=>t.type==='rules-pending'&&t.target.id==='a'));
 assert.doesNotMatch(JSON.stringify(result),/private@example/);
});

