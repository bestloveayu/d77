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
test('missing, conflicting, active and unknown rule requirements remain review, never guessed pending',()=>{
 for(const l of [line({shipped:null}),line({purchased:null}),line({evidence:{shipped:'processing'}}),line({evidence:{shipped:'conflict'}}),line({shipped:2,mailed:null}),line({shipped:2,noRulesRequired:null})])assert.equal(classifyFollowUp(order(l)).kind,'review');
 assert.equal(classifyFollowUp(order(line({purchased:1,shipped:0}))).kind,'none');
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

