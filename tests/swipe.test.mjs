import test from 'node:test';import assert from 'node:assert/strict';
import {swipePage,dragOffset} from '../public/swipe.js';
test('drag position follows the finger and stays within one page width',()=>{
  assert.equal(dragOffset(-120,390),-120);assert.equal(dragOffset(90,390),90);
  assert.equal(dragOffset(500,390),390);assert.equal(dragOffset(-500,390),-390);
});
test('horizontal swipe cycles pages in both directions',()=>{
  assert.equal(swipePage('overview',-100,10,300),'orders');
  assert.equal(swipePage('notifications',-100,0,300),'overview');
  assert.equal(swipePage('overview',100,0,300),'notifications');
});
test('vertical, short, slow and unknown gestures do not navigate',()=>{
  for(const args of [['orders',10,0,200],['orders',90,100,200],['orders',100,0,1500],['unknown',100,0,200]])assert.equal(swipePage(...args),null);
});

