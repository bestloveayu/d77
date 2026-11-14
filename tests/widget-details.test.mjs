import test from 'node:test';
import assert from 'node:assert/strict';
import {widgetSummary} from '../worker/widget.mjs';
import {changes} from '../worker/model.mjs';
import {displayEvent} from '../worker/notification-display.mjs';
const order={id:'o',name:'測試顧客',email:'secret@example.com',phone:'0912345678',total:2500,progress:{purchased:0},lines:[{name:'遊戲甲',quantity:2,price:1250,purchased:0}]};
const product={name:'遊戲甲',sourceNames:['A遊戲甲'],stock:8,usedStock:1,shortage:0,rules:[{name:'遊戲甲_中文規則.pdf',url:'https://private.test'}]};
const snapshot={season:'2026秋',updatedAt:'2026-11-05T00:00:00Z',orders:[order],products:[product],transactions:[],operations:[]};
test('widget exposes requested facts and verified navigation targets, never contacts or rule URLs',()=>{
  const out=widgetSummary(snapshot,[{type:'order',target:{id:'o'},time:snapshot.updatedAt}]);
  assert.match(out.events[0].title,/測試顧客/);assert.match(out.events[0].body,/遊戲甲 ×2/);assert.ok(!out.events[0].body.includes('2,500'));
  assert.ok(!JSON.stringify(out).includes('secret@example.com'));assert.ok(!JSON.stringify(out).includes('0912345678'));
  assert.ok(!JSON.stringify(out).includes('private.test'));assert.deepEqual(out.events[0].target,{id:'o'});
  assert.match(out.todos[0].title,/測試顧客/);
});
test('rule and stock updates include file, canonical product and signed quantity without cash',()=>{
  const tx={id:'row-5',name:'A遊戲甲',kind:'進貨成本',quantity:3,amount:900,actor:'于正'};
  const out=widgetSummary({...snapshot,transactions:[tx]},[{type:'rules',target:{name:'遊戲甲'},time:snapshot.updatedAt},{type:'stock',target:{transactionId:'row-5'},time:snapshot.updatedAt}]);
  assert.match(out.events[0].body,/遊戲甲_中文規則.pdf/);
  assert.match(out.events[1].title,/遊戲甲 庫存增加/);assert.match(out.events[1].body,/全新 \+3 盒 · 于正登記/);assert(!out.events[1].body.includes('900'));
});
test('feed retains more than eight events and excludes arbitrary text',()=>{
  const out=widgetSummary(snapshot,Array.from({length:20},()=>({type:'activity',title:'secret@example.com',detail:'0912345678'})));
  assert.equal(out.events.length,20);assert.ok(!JSON.stringify(out).includes('secret@example.com'));
});
test('new stock movement and rule file additions are detected without historical flood',async()=>{
  const before={...snapshot,orders:[],products:[{...product,rules:[{name:'old'}]}],transactions:[],followUpVersion:1};
  const after={...before,updatedAt:'2026-11-05T01:00:00Z',products:[product],transactions:[{id:'row-5',name:'A遊戲甲',quantity:3,kind:'進貨成本',amount:900,actor:'于正',time:'2026/11/5 09:00'}]};
  const out=await changes(before,after);
  assert.equal(out.filter(e=>e.type==='stock').length,1);assert.equal(out.filter(e=>e.type==='rules').length,1);
  assert.deepEqual(await changes(after,after),[]);assert.deepEqual(await changes(null,after),[]);
});
test('card-only event stays card-only across web, widget and later snapshots',async()=>{
 const rule={id:'r',name:'遊戲甲_中文規則.pdf',modifiedTime:'1'},card={id:'c',name:'遊戲甲_中文卡牌.pdf',cards:true,modifiedTime:'1'};
 const before={...snapshot,products:[{...product,rules:[rule,card]}]};
 const next={...before,products:[{...product,rules:[rule,{...card,modifiedTime:'2'}]}]};
 const event=(await changes(before,next)).find(e=>e.type==='rules');
 assert.equal(event.title,'遊戲甲 中文卡牌更新');
 assert.equal(displayEvent(event,next).detail,card.name);
 assert.equal(widgetSummary(snapshot,[event]).events[0].title,event.title);
 assert.equal(widgetSummary(snapshot,[event]).events[0].body,card.name);
 assert.deepEqual(await changes(next,next),[]);
});
test('edited transaction is not misreported as a new receipt and saved delta never changes',async()=>{
 const tx={id:'row-5',name:'遊戲甲',quantity:3,actor:'于正'};
 const before={...snapshot,transactions:[tx]},next={...before,transactions:[{...tx,quantity:2}]};
 assert.equal((await changes(before,next)).filter(e=>e.type==='stock').length,0);
 const event=(await changes({...snapshot,transactions:[]},before)).find(e=>e.type==='stock');
 assert.match(displayEvent(event,next).detail,/\+3/);
 assert.match(widgetSummary(next,[event]).events[0].body,/\+3/);
});
