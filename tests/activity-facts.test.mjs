import test from 'node:test';
import assert from 'node:assert/strict';
import {ruleChanges,ruleFacts,stockFacts,shortageFacts} from '../worker/activity-facts.mjs';
import {displayEvent} from '../worker/notification-display.mjs';
import {widgetSummary} from '../worker/widget.mjs';
import {notificationPayload} from '../worker/browser-push.mjs';
test('shortage detail is identical across web, push and widget and never borrows current stock',()=>{
 const facts=shortageFacts({name:'北海',shortage:4,stock:14,usedShortage:1,usedStock:0});
 assert.equal(facts.title,'北海 庫存不足');
 assert.equal(facts.body,'全新缺 4 盒 · 全新庫存 14 盒；二手缺 1 盒 · 二手庫存 0 盒');
 const e={id:'e',type:'shortage',title:facts.title,detail:facts.body,activityFacts:facts,target:{page:'inventory',name:'北海'}};
 const s={orders:[],products:[{name:'北海',stock:99,shortage:0}],transactions:[]};
 assert.equal(displayEvent(e,s).detail,facts.body);
 assert.equal(widgetSummary(s,[e]).events[0].body,facts.body);
 assert.equal(notificationPayload(e).body,facts.body);
 assert.deepEqual(shortageFacts({name:'甲',usedShortage:2,usedStock:null}),{title:'甲 庫存不足',body:'二手缺 2 盒 · 二手庫存 待核對 盒'});
});
test('legacy shortage event keeps stored counts instead of showing current stock',()=>{
 const e={type:'shortage',widgetFacts:{title:'北海 · 缺貨',body:'全新尚缺 4 盒；全新庫存 14 盒'}};
 const out=displayEvent(e,{products:[{name:'北海',stock:99}]});
 assert.equal(out.title,'北海 庫存不足');assert.equal(out.detail,e.widgetFacts.body);
});
test('rules distinguish changed cards and rules, ignore order and unchanged files',()=>{
 const r={id:'r',name:'遊戲_中文規則.pdf',modifiedTime:'1'},c={id:'c',name:'遊戲_中文卡牌.pdf',cards:true,modifiedTime:'1'};
 assert.deepEqual(ruleChanges([r,c],[c,r]),[]);
 assert.deepEqual(ruleChanges([r,c],[{...c,modifiedTime:'2'},r]),[{...c,modifiedTime:'2'}]);
 assert.equal(ruleFacts('遊戲',[c]).title,'遊戲 中文卡牌更新');
 assert.equal(ruleFacts('遊戲',[r]).title,'遊戲 中文規則更新');
 assert.equal(ruleFacts('遊戲',[r,c]).title,'遊戲 規則與卡牌更新');
 assert.deepEqual(ruleChanges([r],[]),[]);
});
test('stock facts retain signed new or used quantities and operator without money',()=>{
 assert.deepEqual(stockFacts({name:'牌架日本',quantity:5,actor:'于正'}),{title:'牌架日本 庫存增加',body:'全新 +5 盒 · 于正登記'});
 assert.deepEqual(stockFacts({name:'米寶山（二手）',quantity:-1,actor:'小東'}),{title:'米寶山 庫存減少',body:'二手 −1 盒 · 小東登記'});
 assert.equal(stockFacts({name:'遊戲',quantity:0}),null);
});
