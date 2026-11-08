import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/order-image.js';

const {valid,zip}=globalThis.D77OrderImage;
const order={name:'測試顧客',total:1490,lines:[{name:'本體',price:1490,quantity:1}]};
test('export rejects unresolved prices, missing quantities and mismatched totals',()=>{
  assert.ok(valid(order));
  assert.ok(!valid({...order,total:null}));
  assert.ok(!valid({...order,total:0,lines:[{name:'本體',price:null,quantity:1}]}));
  assert.ok(!valid({...order,lines:[{name:'本體',price:1490,quantity:null}]}));
  assert.ok(!valid({...order,total:1}));
});
test('ZIP stores independent UTF-8 PNG entries and directory offsets',async()=>{
  const files=['甲.png','乙.png'].map(name=>({name,blob:new Blob([new Uint8Array([137,80,78,71])])}));
  const buffer=await (await zip(files)).arrayBuffer(),view=new DataView(buffer),bytes=new Uint8Array(buffer);
  const end=buffer.byteLength-22;
  assert.equal(view.getUint32(end,true),0x06054b50);
  assert.equal(view.getUint16(end+10,true),2);
  let directory=view.getUint32(end+16,true);
  for(const f of files){
    assert.equal(view.getUint32(directory,true),0x02014b50);
    const offset=view.getUint32(directory+42,true),length=view.getUint16(directory+28,true);
    assert.equal(view.getUint32(offset,true),0x04034b50);
    assert.equal(new TextDecoder().decode(bytes.slice(directory+46,directory+46+length)),f.name);
    assert.deepEqual([...bytes.slice(offset+30+length,offset+34+length)],[137,80,78,71]);
    directory+=46+length;
  }
});
