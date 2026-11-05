import test from 'node:test';
import assert from 'node:assert/strict';
import {BoardStore} from '../worker/index.mjs';
test('widget reads return existing snapshot without waiting for a slow Google refresh',async()=>{
  const snapshot={season:'2026秋',updatedAt:'2026-01-01T00:00:00Z',orders:[],products:[]};
  const values=new Map([['snapshot-meta',{count:1}],['snapshot:0',JSON.stringify(snapshot)]]);
  const storage={get:async k=>values.get(k),list:async()=>new Map()};
  const tasks=[];const board=new BoardStore({storage,waitUntil:p=>tasks.push(p)},{});
  let finish;board.update=()=>new Promise(r=>{finish=r;});
  const response=await Promise.race([board.fetch(new Request('https://internal/snapshot',{headers:{'X-User':'u','X-Email':'test@example.com','X-Widget-Cached':'1'}})),new Promise((_,reject)=>setTimeout(()=>reject(Error('blocked on refresh')),300))]);
  const body=await response.json();assert.equal(body.snapshot.season,'2026秋');assert.equal(body.stale,true);assert.equal(tasks.length,1);finish();
});
