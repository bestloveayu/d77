import test from 'node:test';
import assert from 'node:assert/strict';
import {displayEvent} from '../worker/notification-display.mjs';
const snapshot={orders:[{id:'o',name:'陳元笙',lines:[{name:'遊戲甲',quantity:2,price:990}]}]};
test('saved activity gets new copy without changing identity, time or read flag',()=>{
 const event={id:'old',type:'order',title:'新增預購訂單',detail:'有新的訂單等待查看',target:{id:'o'},time:'2026-11-12T12:00:00Z',read:true};
 const out=displayEvent(event,snapshot);
 assert.equal(out.title,'陳元笙 新增預購');assert.match(out.detail,/遊戲甲 ×2/);
 assert.equal(out.id,event.id);assert.equal(out.time,event.time);assert.equal(out.read,true);assert.equal(event.title,'新增預購訂單');
});
test('old shortage and rule titles are replaced without losing details',()=>{
 for(const [type,title] of [['shortage','庫存不足'],['rules','中文規則更新']])assert.equal(displayEvent({type,detail:'遊戲甲'},snapshot).title,title);
});
test('saved facts work for removed customer without borrowing another identity',()=>{
 const out=displayEvent({type:'order',widgetFacts:{title:'舊顧客 · 新增訂單',body:'舊品項 ×1；合計 $990'}},{orders:[]});
 assert.equal(out.title,'舊顧客 新增預購');assert.match(out.detail,/舊品項/);
 assert.equal(displayEvent({type:'order'},{orders:[]}).title,'姓名待核對 新增預購');
});
test('old shipment and mail do not guess historical operator from current order',()=>{
 assert.equal(displayEvent({type:'shipment',target:{id:'o'},detail:'雲端已確認'},snapshot).detail,'登記人待確認');
 assert.equal(displayEvent({type:'mail',target:{id:'o'},detail:'于正寄送'},snapshot).detail,'于正寄送');
});

