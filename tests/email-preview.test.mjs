import test from 'node:test';
import assert from 'node:assert/strict';
import {emailGroups,emailDraft,mailUrl} from '../public/email-preview.js';
const order={id:'a',name:'王小明',email:'a@example.com',total:100,lines:[{name:'甲',quantity:1,price:100}]};
test('same name and email combine only for output; different recipients remain separate',()=>{
 const source=[order,{...order,id:'b'},{...order,id:'c',email:'b@example.com'}];
 const old=JSON.stringify(source),groups=emailGroups(source);
 assert.equal(groups.length,2);assert.equal(groups[0].length,2);assert.equal(JSON.stringify(source),old);
 assert.equal(emailGroups([{...order,email:''},{...order,email:''}]).length,2);
});
test('draft respects shortage/removal and de-duplicates safe rule URLs',()=>{
 const draft=emailDraft([{...order,lines:[...order.lines,{name:'乙',quantity:2,price:20,exportShortage:true}],total:100}],
 [{name:'甲',rules:[{url:'https://example.com/rules'}]},{name:'乙',rules:[{url:'https://example.com/other'}]}],'2026秋');
 assert.match(draft.body,/甲 ×1/);assert.match(draft.body,/乙 ×2.*缺貨/);assert.match(draft.body,/總金額：\$100/);
 assert.equal(draft.ruleNames.join(','),'甲');assert.doesNotMatch(draft.body,/example.com\/other/);
 assert.match(mailUrl(draft),/^mailto:a%40example.com\?subject=/);
});
test('unknown price cannot become zero and cross recipients cannot form one draft',()=>{
 assert.throws(()=>emailDraft([{...order,lines:[{name:'甲',price:null,quantity:1}]}],[]),/金額/);
 assert.throws(()=>emailDraft([order,{...order,email:'b@example.com'}],[]),/同一位/);
});

