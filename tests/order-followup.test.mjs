import test from 'node:test';import assert from 'node:assert/strict';
import {classifyFollowUp,needsAttention} from '../public/order-followup.js';
test('shipped but unmailed or review orders stay in general pending work',()=>{
 assert(needsAttention({...order(line({shipped:2})),status:'已出貨'}));
 assert(needsAttention({...order(line({shipped:2,noRulesRequired:null})),status:'已出貨'}));
 assert.equal(needsAttention({...order(line({shipped:2,mailed:1})),status:'已出貨'}),false);
});
import {changes,catalog} from '../worker/model.mjs';
const line=(overrides={})=>({quantity:2,purchased:2,shipped:0,mailed:0,noRulesRequired:false,evidence:{purchased:'confirmed',shipped:'confirmed',mailed:'confirmed'},...overrides});
const order=(l=line())=>({id:'one',issues:[],lines:[l]});
test('confirmed orders waiting for registration and for required rules are distinct',()=>{
 assert.equal(classifyFollowUp(order()).kind,'registration');
 assert.equal(classifyFollowUp(order(line({shipped:2}))).kind,'rules');
 assert.equal(classifyFollowUp(order(line({shipped:2,mailed:1}))).kind,'none');
 assert.equal(classifyFollowUp(order(line({shipped:2,noRulesRequired:true,mailed:null}))).kind,'none');
});
test('conflicting and active evidence stays review; no purchase evidence is not a pending shipment',()=>{
 for(const l of [line({evidence:{shipped:'processing'}}),line({evidence:{shipped:'conflict'}})])assert.equal(classifyFollowUp(order(l)).kind,'review');
 assert.equal(classifyFollowUp(order(line({purchased:null}))).kind,'none');
 assert.equal(classifyFollowUp(order(line({purchased:1,shipped:0}))).kind,'registration');
});

test('confirmed purchase with no shipment resource is a registration follow-up without inventing quantities',()=>{
 const l=line({shipped:null,evidence:{purchased:'confirmed',shipped:'missing',mailed:'missing'}});
 assert.equal(classifyFollowUp(order(l)).kind,'registration');
 assert.equal(l.shipped,null);
});

test('confirmed shipment does not require separate purchase or mail records to show rule follow-up',()=>{
 const l=line({purchased:null,shipped:2,mailed:null,noRulesRequired:null,evidence:{purchased:'missing',shipped:'confirmed',mailed:'missing'}});
 assert.equal(classifyFollowUp(order(l)).kind,'rules');
 assert.match(classifyFollowUp(order(l)).reason,/需求待核對/);
 assert.equal(classifyFollowUp(order({...l,noRulesRequired:true})).kind,'none');
 assert.equal(classifyFollowUp(order({...l,mailed:1})).kind,'none');
});
test('partial registrations and mixed required/exempt games are classified safely',()=>{
 assert.equal(classifyFollowUp(order(line({shipped:1}))).kind,'registration');
 const o=order(line({shipped:2}));o.lines.push(line({shipped:2,noRulesRequired:true,mailed:null}));assert.equal(classifyFollowUp(o).kind,'rules');
});
test('optional cloud exemption is tri-state and never inferred from absent rules',()=>{
 const base=['中文名稱','不需寄送中文規則'];const items=catalog([base,['甲',true],['乙',false],['丙','']]);
 assert.deepEqual(items.map(x=>x.noRulesRequired),[true,false,null]);assert.equal(catalog([['中文名稱'],['甲']])[0].noRulesRequired,null);
});
const snapshot=(o,version=1,time='2026-11-01T12:00:00Z')=>({season:'2026秋',updatedAt:time,followUpVersion:version,orders:[o],products:[],operations:[]});
test('follow-up notifications baseline silently, enter once, and can reenter after resolution',async()=>{
 const before=order(line({purchased:0})),pending=order();before.followUp=classifyFollowUp(before);pending.followUp=classifyFollowUp(pending);
 assert.equal((await changes(snapshot(before,null),snapshot(pending))).filter(e=>e.type==='registration').length,0);
 assert.equal((await changes(snapshot(before),snapshot(pending))).filter(e=>e.type==='registration').length,1);
 assert.equal((await changes(snapshot(pending),snapshot(pending,1,'2026-11-01T12:05:00Z'))).filter(e=>e.type==='registration').length,0);
 const done=order(line({shipped:2,mailed:1}));done.followUp=classifyFollowUp(done);
 const again=await changes(snapshot(done),snapshot(pending,1,'2026-11-01T12:10:00Z'));
 assert.equal(again.filter(e=>e.type==='registration').length,1);
 const waitingRules=order(line({shipped:2}));waitingRules.followUp=classifyFollowUp(waitingRules);
 const mailEvent=await changes(snapshot(pending),snapshot(waitingRules));assert.equal(mailEvent.filter(e=>e.type==='rules-pending').length,1);
 assert.equal((await changes(snapshot(waitingRules),snapshot(waitingRules,1,'2026-11-01T12:15:00Z'))).filter(e=>e.type==='rules-pending').length,0);
});

test('upgrading follow-up classification does not push historical reminders again',async()=>{
 const before=order(line({shipped:null})),after=order();before.followUp={kind:'review'};after.followUp=classifyFollowUp(after);
 assert.equal((await changes(snapshot(before,1),snapshot(after,2))).filter(e=>e.type==='registration').length,0);
});

test('purchase events identify the customer without exposing contact details',async()=>{
 const before={...order(line({purchased:0})),name:'測試顧客'},after={...order(),name:'測試顧客'};
 const events=await changes(snapshot(before),snapshot(after));
 assert.equal(events.find(e=>e.type==='registration').title,'測試顧客 已下單待出貨');
 assert.equal(events.filter(e=>['purchase','registration'].includes(e.type)).length,1);
});
