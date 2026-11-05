import test from 'node:test';
import assert from 'node:assert/strict';
import {WidgetStore,widgetSummary} from '../worker/widget.mjs';
import {createWorker,BoardStore} from '../worker/index.mjs';
function fixture(){
  const values=new Map();let queue=Promise.resolve();
  const storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),delete:async k=>values.delete(k),transaction:fn=>{const p=queue.then(()=>fn(storage));queue=p.catch(()=>{});return p;}};
  const env={ALLOWED_EMAILS:'owner@gmail.com'};
  return {store:new WidgetStore(storage,env),storage,values,env};
}
test('widget pairing is single use, credentials scoped and revocable',async()=>{
  const f=fixture(),user={sub:'u',email:'owner@gmail.com'};
  const pair=await f.store.pair(user);
  assert.match(pair.code,/^[a-f0-9]{32}$/);
  const device=await f.store.redeem(pair.code,'ip');
  assert.match(device.token,/^d77w_[a-f0-9]{64}$/);
  assert.equal((await f.store.restore(device.token)).email,user.email);
  await assert.rejects(()=>f.store.redeem(pair.code,'ip'));
  assert.ok(!JSON.stringify([...f.values]).includes(device.token));
  await f.store.revokeAll(user);
  await assert.rejects(()=>f.store.restore(device.token));
});
test('expired pairing, concurrent redemption and removed allowlist cannot grant access',async()=>{
  const f=fixture(),user={sub:'u',email:'owner@gmail.com'};
  const p=await f.store.pair(user);
  const both=await Promise.allSettled([f.store.redeem(p.code,'ip'),f.store.redeem(p.code,'ip')]);
  assert.equal(both.filter(r=>r.status==='fulfilled').length,1);
  const token=both.find(r=>r.status==='fulfilled').value.token;
  f.env.ALLOWED_EMAILS='';await assert.rejects(()=>f.store.restore(token),{status:403});
  f.env.ALLOWED_EMAILS=user.email;
  const p2=await f.store.pair(user);
  for(const [k,v] of f.values)if(k.startsWith('widget-pair:'))f.values.set(k,{...v,expiresAt:0});
  await assert.rejects(()=>f.store.redeem(p2.code,'ip'));
});
test('invalid codes are rate limited and web session tokens are rejected',async()=>{
  const f=fixture();
  for(let i=0;i<12;i++)await assert.rejects(()=>f.store.redeem('0'.repeat(32),'ip'));
  await assert.rejects(()=>f.store.redeem('0'.repeat(32),'ip'),{status:429});
  await assert.rejects(()=>f.store.restore('d77s_'+'0'.repeat(64)));
});
test('summary includes requested names but excludes contacts and retains unknown/offline state',()=>{
  const order={name:'PRIVATE',email:'private@example.com',lines:[{quantity:2,purchased:0,shipped:0}],progress:{purchased:0}};
  const snapshot={season:'2026秋',updatedAt:'2026-11-05T00:00:00Z',orders:[order],products:[{shortage:2}]};
  const out=widgetSummary(snapshot,[{id:'e',type:'activity',title:'PRIVATE',body:'EMAIL',time:'2026-11-05T00:00:00Z'}],true,'更新失敗');
  assert.equal(out.counts.awaitingPurchase,1);assert.equal(out.counts.shortage,1);
  assert.equal(out.stale,true);assert.ok(JSON.stringify(out).includes('PRIVATE'));assert.ok(!JSON.stringify(out).includes('EMAIL'));assert.ok(!JSON.stringify(out).includes('private@example.com'));
  assert.equal(widgetSummary(null,[],true,'離線').counts.awaitingPurchase,null);
});
test('native credential cannot authorize website or source-management routes',async()=>{
  const f=fixture();f.env.ALLOWED_ORIGIN='https://board.test';
  const board=new BoardStore({storage:f.storage},f.env);
  f.env.BOARD={idFromName:n=>n,get:()=>({fetch:(url,init)=>board.fetch(new Request(url,init))})};
  const worker=createWorker(async req=>{
    if(req.headers.get('Authorization')!=='Bearer google')throw Object.assign(new Error('invalid'),{status:401});
    return {sub:'u',email:'owner@gmail.com'};
  });
  const call=(path,method,token,body)=>worker.fetch(new Request('https://api.test'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),f.env);
  const pair=await (await call('/widget/pair','POST','google',{})).json();
  const redeemed=await call('/widget/redeem','POST',null,{code:pair.code});assert.equal(redeemed.status,200);
  const device=await redeemed.json();
  for(const [path,method] of [['/snapshot','GET'],['/seasons/save','POST'],['/widget/pair','POST'],['/preferences','POST']])assert.equal((await call(path,method,device.token,method==='POST'?{}:null)).status,401);
  assert.equal((await call('/widget/redeem','GET',null)).status,405);
  assert.equal((await call('/internal/widget/pair','POST','google',{})).status,404);
  assert.equal((await call('/widget/logout','POST',device.token,{})).status,200);
  assert.equal((await call('/widget/data','GET',device.token)).status,401);
});
test('authenticated widget data route returns minimized snapshot, preserves stale state',async()=>{
  const f=fixture();f.env.ALLOWED_ORIGIN='https://board.test';
  const board=new BoardStore({storage:f.storage},f.env);
  let reads=0;
  f.env.BOARD={idFromName:n=>n,get:n=>({fetch:(url,init)=>{
    const path=new URL(url).pathname;
    if(n==='shared-v1'&&path==='/internal/config')return Response.json({season:'2026秋',configDigest:'d',isDefault:true,config:{season:'2026秋'}});
    if(n!=='shared-v1'){
      reads++;
      if(path==='/snapshot')return Response.json({snapshot:{season:'2026秋',updatedAt:'2026-11-05T00:00:00Z',orders:[],products:[]},stale:true,error:{message:'private source details'}});
      if(path==='/notifications')return Response.json({events:[{type:'activity',title:'PRIVATE',time:'2026-11-05T00:00:00Z'}]});
    }
    return board.fetch(new Request(url,init));
  }})};
  const p=await f.store.pair({sub:'u',email:'owner@gmail.com'}),device=await f.store.redeem(p.code,'ip');
  const worker=createWorker(()=>{throw Error('Google fallback must not be used');});
  const result=await worker.fetch(new Request('https://api.test/widget/data',{headers:{Authorization:'Bearer '+device.token}}),f.env);
  assert.equal(result.status,200);const body=await result.json();
  assert.equal(body.stale,true);assert.equal(reads,2);
  assert.ok(!JSON.stringify(body).includes('PRIVATE'));assert.ok(!JSON.stringify(body).includes('private source'));
});
