import test from 'node:test';import assert from 'node:assert/strict';
import {filterTransactions,transactionTotals,transactionAmount} from '../public/transaction-summary.js';
const rows=[{name:'甲',kind:'銷貨收入',income:150,cost:0,actor:'小東、于正',cashByPerson:{east:{income:100,cost:0},yu:{income:50,cost:0}}},{name:'乙',kind:'進貨成本',income:0,cost:40,actor:'小東',cashByPerson:{east:{income:0,cost:40},yu:{income:0,cost:0}}},{name:'結算',kind:'結算',income:0,cost:0,amount:20,settlement:20,cashByPerson:{east:{income:0,cost:0},yu:{income:0,cost:0}}}];
test('filtered subtotal uses only selected rows and selected person cash',()=>{
 assert.deepEqual(transactionTotals(rows),{income:150,cost:40,profit:110,count:3});
 const east=filterTransactions(rows,{person:'east'});assert.deepEqual(transactionTotals(east,'east'),{income:100,cost:40,profit:60,count:3});
 const yu=filterTransactions(rows,{person:'yu'});assert.equal(yu.length,2);assert.equal(transactionTotals(yu,'yu').income,50);
 const sale=filterTransactions(rows,{type:'銷貨收入',search:'甲',person:'east'});assert.equal(sale.length,1);assert.equal(transactionAmount(sale[0],'east'),100);
 assert.equal(transactionTotals(sale,'east').profit,100);assert.equal(filterTransactions(rows,{search:'不存在'}).length,0);
 assert.deepEqual(transactionTotals([]),{income:0,cost:0,profit:0,count:0});
});
test('invalid or unavailable cash is never silently zeroed; settlement not counted as income',()=>{
 assert.deepEqual(transactionTotals([rows[2]]),{income:0,cost:0,profit:0,count:1});
 const invalid={...rows[0],income:null,cashByPerson:{east:{income:null,cost:0}}};
 assert.equal(transactionTotals([invalid]).income,null);assert.equal(transactionTotals([invalid]).profit,null);
 assert.equal(transactionTotals([invalid],'east').income,null);
 assert.equal(transactionTotals([{income:10,cost:0,actor:'小東'}],'east').income,null);
 assert.equal(transactionTotals(rows).income,150);
});
