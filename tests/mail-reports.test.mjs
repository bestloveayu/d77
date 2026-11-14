import test from 'node:test';
import assert from 'node:assert/strict';
import {recordMailReport,listMailReports,mailRecipients} from '../worker/mail-reports.mjs';
import {BoardStore,createWorker} from '../worker/index.mjs';
import {digest} from '../worker/model.mjs';
function fixture(){
  const values=new Map();let queue=Promise.resolve();
  const storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),delete:async k=>values.delete(k),transaction:fn=>{const task=queue.then(()=>fn(storage));queue=task.catch(()=>{});return task;}};
  const snapshot={season:'2026秋',updatedAt:new Date().toISOString(),orders:[{id:'o1',name:'Customer',lines:[{name:'Game',mailed:null}]},{id:'o2',name:'Customer',lines:[{name:'Game',mailed:0}]}],products:[{name:'Game',rules:[{url:'https://drive.google.com/file/d/abc/view'}]}]};
  for(const o of snapshot.orders)values.set('mail-recipient:'+o.id,{updatedAt:snapshot.updatedAt,id:o.id,name:o.name,email:'customer@example.com'});
  const body={reportId:'test-report-000001',orderIds:['o1','o2'],kind:'rules',items:['Game'],recipient:' Customer@Example.com ',sourceUpdatedAt:snapshot.updatedAt};
  const actor={sub:'user1',email:'owner@gmail.com'};
  const run=(b=body,s=snapshot,a=actor)=>recordMailReport(storage,s,b,a,'2026秋');
  return {values,storage,snapshot,body,actor,run};
}
test('atomic manual activity, immutable snapshot, exact idempotency and evidence',async()=>{
  const f=fixture(),before=structuredClone(f.snapshot);
  const results=await Promise.all([f.run(),f.run()]);
  assert.equal(results.filter(r=>r.duplicate).length,1);
  const result=results.find(r=>!r.duplicate);
  assert.equal(result.event.type,'activity');assert.equal(result.event.title,'Customer 規則已寄送（手機）');
  assert.match(result.event.detail,/待桌面確認/);assert.match(result.event.detail,/owner@gmail.com/);
  assert.match(result.event.detail,/Game/);
  assert.deepEqual(result.event.widgetFacts,{title:result.event.title,body:'Game；待桌面確認'});
  assert(!JSON.stringify(result.event.widgetFacts).includes('@'));
  assert.deepEqual(result.event.target,{page:'orders',id:'o1'});
  assert.deepEqual(f.snapshot,before);assert.equal(f.values.get('event-index').length,1);
  const list=await listMailReports(f.storage);assert.equal(list.reports.length,1);
  assert.equal(list.reports[0].recipient,'customer@example.com');assert.equal(list.reports[0].season,'2026秋');
  await assert.rejects(f.run({...f.body,kind:'order'}),{status:409});
  assert.equal((await f.run(f.body,{...f.snapshot,updatedAt:'2000-01-01'})).duplicate,true);
});
test('reject invalid recipients, unknown IDs, names and unavailable rules without writes',async()=>{
  for(const mutate of [f=>f.body.recipient='other@example.com',f=>f.body.orderIds=['absent'],f=>f.body.items=['Other'],f=>f.snapshot.orders[1].name='Other',f=>f.snapshot.products[0].rules=[],f=>f.snapshot.orders[0].lines[0].noRulesRequired=true,f=>f.body.orderIds=['o1','o1'],f=>f.body.items=[],f=>f.body.reportId='short']){
    const f=fixture();mutate(f);await assert.rejects(f.run(),e=>[400,409].includes(e.status));assert.equal(f.values.has('event-index'),false);
  }
});
test('freshness and private contact generation are required',async()=>{
  const f=fixture();await assert.rejects(f.run(f.body,{...f.snapshot,updatedAt:new Date(Date.now()-900001).toISOString()}),{status:409});
  f.values.delete('mail-recipient:o1');await assert.rejects(f.run(),{status:409});
});
test('hourly bound, retry exemption, pagination and season isolation',async()=>{
  const f=fixture();
  for(let i=0;i<30;i++)await f.run({...f.body,reportId:'test-report-'+String(i).padStart(8,'0'),kind:'order'});
  await assert.rejects(f.run(),{status:429});
  assert.equal((await f.run({...f.body,reportId:'test-report-00000000',kind:'order'})).duplicate,true);
  const first=await listMailReports(f.storage,10),second=await listMailReports(f.storage,10,first.nextCursor);
  assert.equal(first.reports.length,10);assert.equal(second.reports.length,10);assert.notEqual(first.reports[0].reportId,second.reports[0].reportId);
  const other=fixture();assert.equal((await other.run()).duplicate,false);
});
test('DO authentication, push once, methods and evidence response',async()=>{
  const f=fixture();f.values.set('snapshot-meta',{count:1});f.values.set('snapshot:0',JSON.stringify(f.snapshot));
  const board=new BoardStore({storage:f.storage},{});let pushes=0;board.push=async()=>{pushes++;};
  const call=(path,method='POST',body=f.body,auth=true)=>board.fetch(new Request('https://internal'+path,{method,headers:{...(auth?{'X-User':'user1','X-Email':'owner@gmail.com'}:{}),'X-Source-Config':JSON.stringify({season:'2026\u79cb'}).replace(/秋/g,'\\u79cb'),'X-Notify':'1'},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
  assert.equal((await call('/mail-report','POST',f.body,false)).status,401);
  assert.equal((await call('/mail-report')).status,200);assert.equal((await call('/mail-report')).status,200);assert.equal(pushes,1);
  assert.equal((await call('/mail-report','GET')).status,405);
  assert.equal((await(await call('/mail-reports','GET')).json()).reports.length,1);
  assert.equal((await call('/mail-reports?limit=101','GET')).status,400);
  assert.equal((await call('/mail-report','POST',{...f.body,reportId:'x'.repeat(9000)})).status,413);
});
test('public worker routes enforce authentication and method before season lookup',async()=>{
  const worker=createWorker(async()=>{throw Object.assign(new Error('unauthorized'),{status:401});});
  for(const path of ['/mail-report','/mail-reports','/mail-recipients'])assert.equal((await worker.fetch(new Request('https://api.test'+path),{ALLOWED_ORIGIN:'https://board.test'})).status,401);
});
test('authenticated session routes select the season DO and preserve query pagination',async()=>{
  const f=fixture(),board=new BoardStore({storage:f.storage},{});
  f.values.set('snapshot-meta',{count:1});f.values.set('snapshot:0',JSON.stringify(f.snapshot));
  const config={season:'2026秋'};let routed=0;
  const env={ALLOWED_ORIGIN:'https://board.test',BOARD:{idFromName:n=>n,get:n=>({fetch:async(url,init)=>{
    const req=new Request(url,init);
    if(n==='shared-v1'&&new URL(url).pathname==='/internal/session/restore')return Response.json({sub:'user1',email:'owner@gmail.com'});
    if(n==='shared-v1')return Response.json({season:'2026秋',configDigest:'abc',config,isDefault:false});
    assert.equal(n,'season:2026秋:abc');routed++;return board.fetch(req);
  }})}};
  let pushes=0;board.push=async()=>pushes++;
  const worker=createWorker(()=>{throw Error('must use session');});
  const call=(path,method='GET')=>worker.fetch(new Request('https://api.test'+path,{method,headers:{Authorization:'Bearer d77s_'+'a'.repeat(64)},...(method==='POST'?{body:JSON.stringify(f.body)}:{})}),env);
  assert.equal((await call('/mail-report?season=2026秋','POST')).status,200);
  assert.equal(pushes,0);assert.equal((await call('/mail-reports?season=2026秋&limit=101')).status,400);
  assert.equal((await call('/mail-reports?season=2026秋','POST')).status,405);
  const recipients=await call('/mail-recipients?season=2026秋','POST');assert.equal(recipients.status,200);
  assert.deepEqual((await recipients.json()).recipients,f.snapshot.orders.map(o=>({id:o.id,name:o.name,email:'customer@example.com'})));
  assert.equal((await call('/mail-recipients?season=2026秋')).status,405);
  assert.equal(routed,3);
});
test('selected recipients are authoritative, minimized, read-only and ordered',async()=>{
  const f=fixture(),before=structuredClone([...f.values]);
  const result=await mailRecipients(f.storage,f.snapshot,{orderIds:['o2','o1']},'2026秋');
  assert.deepEqual(result,{recipients:[{id:'o2',name:'Customer',email:'customer@example.com'},{id:'o1',name:'Customer',email:'customer@example.com'}],updatedAt:f.snapshot.updatedAt});
  assert.deepEqual([...f.values],before);assert(!JSON.stringify(f.snapshot).includes('example.com'));
});
test('recipient lookup rejects size, duplicates, unknown orders, stale and mismatched private data',async()=>{
  for(const ids of [[],['o1','o1'],['missing'],Array.from({length:51},(_,i)=>'o'+i),['x'.repeat(201)],[null]]){
    const f=fixture();await assert.rejects(mailRecipients(f.storage,f.snapshot,{orderIds:ids},'2026秋'),{status:400});
  }
  for(const mutate of [f=>f.snapshot.updatedAt=new Date(Date.now()-900001).toISOString(),f=>f.values.delete('mail-recipient:o1'),f=>f.values.get('mail-recipient:o1').updatedAt='old',f=>f.snapshot.season='2027春']){
    const f=fixture();mutate(f);await assert.rejects(mailRecipients(f.storage,f.snapshot,{orderIds:['o1']},'2026秋'),{status:409});
  }
  for(const mutate of [f=>f.values.get('mail-recipient:o1').name='Wrong',f=>f.values.get('mail-recipient:o1').email='invalid']){
    const f=fixture();mutate(f);await assert.rejects(mailRecipients(f.storage,f.snapshot,{orderIds:['o1']},'2026秋'),{status:400});
  }
});
test('recipient endpoint rejects widget credentials without fallback',async()=>{
  const worker=createWorker(async()=>{throw Object.assign(new Error('invalid credential'),{status:401});});
  const response=await worker.fetch(new Request('https://api.test/mail-recipients',{method:'POST',headers:{Authorization:'Bearer d77w_'+'a'.repeat(64)},body:JSON.stringify({orderIds:['o1']})}),{ALLOWED_ORIGIN:'https://board.test'});
  assert.equal(response.status,401);
});
test('source generation evidence remains immutable after later source changes and retries',async()=>{
  const f=fixture();
  Object.assign(f.snapshot.orders[0].lines[0],{originalName:'Source Game',quantity:2,price:450});
  f.snapshot.orders[0].lines.push({name:'Unselected',quantity:99,price:999});
  f.snapshot.products[0].rules[0].name='Game rules.pdf';
  const {report}=await f.run(),saved=structuredClone(report.sourceEvidence);
  assert.equal(saved.updatedAt,f.snapshot.updatedAt);
  assert.deepEqual(saved.orders.find(o=>o.id==='o1').selectedLines,[{name:'Game',originalName:'Source Game',quantity:2,price:450}]);
  assert.deepEqual(saved.ruleFiles,[{item:'Game',name:'Game rules.pdf',url:'https://drive.google.com/file/d/abc/view'}]);
  const {digest:hash,...evidence}=saved;assert.equal(hash,await digest(evidence));
  assert(!JSON.stringify(saved).includes('example.com'));assert(!JSON.stringify(saved).includes('Unselected'));
  f.snapshot.updatedAt=new Date(Date.now()+1000).toISOString();
  Object.assign(f.snapshot.orders[0].lines[0],{name:'Changed',quantity:9,price:1});
  Object.assign(f.snapshot.products[0].rules[0],{name:'Changed.pdf',url:'https://example.com/new'});
  assert.deepEqual(report.sourceEvidence,saved);
  assert.deepEqual((await listMailReports(f.storage)).reports[0].sourceEvidence,saved);
  assert.deepEqual((await f.run()).report.sourceEvidence,saved);
  assert.equal(report.status,'manual-pending-desktop');
});
test('oversized source evidence is rejected without persisting a report',async()=>{
  const f=fixture();f.snapshot.products[0].rules[0].name='x'.repeat(64001);
  await assert.rejects(f.run(),{status:413});assert.equal(f.values.has('mail-report-index'),false);
});
test('source version is required and mismatched new reports do not write',async()=>{
  for(const version of [undefined,null,'invalid','2026-02-30T00:00:00.000Z']){
    const f=fixture();await assert.rejects(f.run({...f.body,sourceUpdatedAt:version}),{status:400});assert(!f.values.has('mail-report-index'));
  }
  const f=fixture(),original=structuredClone([...f.values]);
  const later=new Date(Date.parse(f.snapshot.updatedAt)+1000).toISOString();
  await assert.rejects(f.run({...f.body,sourceUpdatedAt:later}),{status:409});assert.deepEqual([...f.values],original);
  await f.run();f.snapshot.updatedAt=later;
  assert.equal((await f.run()).duplicate,true);
  await assert.rejects(f.run({...f.body,sourceUpdatedAt:later}),{status:409});
});
test('recipient lookup version matching returns version and mismatch never writes',async()=>{
  const f=fixture(),before=structuredClone([...f.values]);
  const body={orderIds:['o1'],expectedUpdatedAt:f.snapshot.updatedAt};
  assert.equal((await mailRecipients(f.storage,f.snapshot,body,'2026秋')).updatedAt,f.snapshot.updatedAt);
  await assert.rejects(mailRecipients(f.storage,f.snapshot,{...body,expectedUpdatedAt:new Date(Date.now()-1000).toISOString()},'2026秋'),{status:409});
  await assert.rejects(mailRecipients(f.storage,f.snapshot,{...body,expectedUpdatedAt:'invalid'},'2026秋'),{status:400});
  assert.deepEqual([...f.values],before);
});

