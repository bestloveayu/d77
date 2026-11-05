import test from 'node:test';
import assert from 'node:assert/strict';
import {widgetSummary} from '../worker/widget.mjs';
import {changes} from '../worker/model.mjs';
const order={id:'o',name:'測試顧客',email:'secret@example.com',phone:'0912345678',total:2500,progress:{purchased:0},lines:[{name:'遊戲甲',quantity:2,price:1250,purchased:0}]};
const product={name:'遊戲甲',sourceNames:['A遊戲甲'],stock:8,usedStock:1,shortage:0,rules:[{name:'遊戲甲_中文規則.pdf',url:'https://private.test'}]};
const snapshot={season:'2026秋',updatedAt:'2026-11-05T00:00:00Z',orders:[order],products:[product],transactions:[],operations:[]};
test('widget exposes requested order facts but never contact data or private targets',()=>{
  const out=widgetSummary(snapshot,[{type:'order',target:{id:'o'},time:snapshot.updatedAt}]);
  assert.match(out.events[0].title,/測試顧客/);assert.match(out.events[0].body,/遊戲甲 ×2/);assert.match(out.events[0].body,/2,500/);
  assert.ok(!JSON.stringify(out).includes('secret@example.com'));assert.ok(!JSON.stringify(out).includes('0912345678'));
  assert.ok(!JSON.stringify(out).includes('private.test'));assert.equal(out.events[0].target,undefined);
  assert.match(out.todos[0].title,/測試顧客/);
});
test('rule and stock updates include file, canonical product, quantity and cash facts',()=>{
  const tx={id:'row-5',name:'A遊戲甲',kind:'進貨成本',quantity:3,amount:900,actor:'于正'};
  const out=widgetSummary({...snapshot,transactions:[tx]},[{type:'rules',target:{name:'遊戲甲'},time:snapshot.updatedAt},{type:'stock',target:{transactionId:'row-5'},time:snapshot.updatedAt}]);
  assert.match(out.events[0].body,/遊戲甲_中文規則.pdf/);
  assert.match(out.events[1].body,/遊戲甲.*\+3.*900/);
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
