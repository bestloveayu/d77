import test from 'node:test';
import assert from 'node:assert/strict';
import {ruleLinkText} from '../public/rule-copy.js';

test('rule sharing groups valid links by product and labels cards',()=>{
  const rules={url:'https://example.com/rules'};
  const text=ruleLinkText([
    {name:'測試遊戲',rules:[rules,rules,{url:'https://example.com/cards',cards:true},{url:'javascript:alert(1)'}]},
    {name:'沒有連結',rules:[]},
    {name:'另一款',rules:[{url:'https://example.com/other'}]},
  ]);
  assert.equal(text,'【測試遊戲】\n中文規則：https://example.com/rules\n中文卡牌／卡表：https://example.com/cards\n\n【另一款】\n中文規則：https://example.com/other');
});
