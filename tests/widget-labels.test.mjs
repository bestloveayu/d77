import test from 'node:test';
import assert from 'node:assert/strict';
import {widgetSummary} from '../worker/widget.mjs';
const customer=(id,kind)=>({id,name:'顧客'+id,progress:{purchased:kind==='rules'?1:0},total:1490,lines:[{name:'遊戲甲',quantity:1,price:1490,purchased:kind==='rules'?1:0}],followUp:{kind}});
const snapshot={orders:[customer('a','rules'),customer('b','pending')],products:[],transactions:[],season:'2026秋'};
test('widget pending rules are item-only and unpurchased rows use the preorder label',()=>{
 const out=widgetSummary(snapshot);
 const rules=out.todos.find(t=>t.type==='rules-pending'),order=out.todos.find(t=>t.type==='order');
 assert.match(rules.body,/目前沒有待寄規則品項/);assert.doesNotMatch(rules.body,/1490|1,490|\$|合計|金額待核對/);
 assert.match(order.title,/新增預購$/);assert.doesNotMatch(order.title,/待下單/);
 assert.equal(out.counts.awaitingPurchase,1);assert.equal(out.counts.awaitingRules,1);
});
test('widget-only labels project current and saved events without changing originals',()=>{
 const source=[{type:'purchase',widgetFacts:{title:'顧客乙 · 下單已確認',body:'遊戲甲 ×1（$1,490）；合計 $1,490'}},{type:'rules-pending',widgetFacts:{title:'舊顧客 · 待寄規則',body:'舊遊戲 ×2（$990）；合計 $1,980'}},{type:'order',widgetFacts:{title:'舊顧客 · 新增訂單',body:'遊戲乙 ×1'}}];
 const before=JSON.stringify(source),out=widgetSummary(snapshot,source);
 assert.equal(out.events[0].title,'顧客乙 · 已下單待出貨');assert.doesNotMatch(out.events[1].body,/\$|合計|990|1,980/);assert.match(out.events[1].body,/舊遊戲 ×2/);
 assert.equal(out.events[2].title,'舊顧客 · 新增預購');assert.equal(JSON.stringify(source),before);
});
