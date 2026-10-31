import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeConfig} from '../public/season-config.js';
import {SeasonRegistry} from '../worker/seasons.mjs';
import {seasonObjectName} from '../worker/index.mjs';
const cfg=season=>({season,spreadsheetId:'sample-book',catalogSheet:season+'統計',responseSheet:season+'預購回應',rulesFolderId:'sample-folder'});
test('season and source revision isolate snapshot, notification and read storage',()=>{
  assert.notEqual(seasonObjectName({season:'2026秋',configDigest:'a'}),seasonObjectName({season:'2027春',configDigest:'a'}));
  assert.notEqual(seasonObjectName({season:'2026秋',configDigest:'a'}),seasonObjectName({season:'2026秋',configDigest:'b'}));
});
function fixture(){const values=new Map(),storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),delete:async k=>values.delete(k),transaction:async fn=>fn(storage)};
  let reads=0;const collect=async(env,config)=>{reads++;if(config.catalogSheet==='missing')throw new Error('找不到分頁');return {season:config.season,updatedAt:new Date().toISOString(),summary:{orders:3,rulesTotal:5,rulesReady:2,shortages:1},orders:[],products:[]};};
  const registry=new SeasonRegistry(storage,{},collect);const call=(path,body,admin=true,user='owner')=>registry.handle(new Request('https://internal'+path,{method:body?'POST':'GET',headers:{'X-User':user,'X-Manager':admin?'1':'0','X-Email':user+'@example.test'},...(body?{body:JSON.stringify(body)}:{})}));
  return {registry,call,values,reads:()=>reads};}
test('normalize pasted Google links and default source names; reject unsafe input',()=>{
  const value=normalizeConfig({...cfg('2027春'),spreadsheetId:'https://docs.google.com/spreadsheets/d/sample-book/edit?gid=1',rulesFolderId:'https://drive.google.com/drive/folders/sample-folder'});
  assert.equal(value.spreadsheetId,'sample-book');assert.equal(value.rulesFolderId,'sample-folder');assert.equal(value.teamSheet,'_collaboration_v1');
  for(const value of [{...cfg('spring')},{...cfg('2027春'),spreadsheetId:'https://evil.test/a'},{...cfg('2027春'),catalogSheet:'=IMPORTDATA()'},{...cfg('2027春'),aliases:{a:3}}])assert.throws(()=>normalizeConfig(value));
});
test('source requires manager and successful test bound to the same user/config/revision',async()=>{
  const f=fixture(),body={config:cfg('2027春'),expectedRevision:0,mode:'create'};
  assert.equal((await f.call('/seasons/test',body,false)).status,403);
  assert.equal((await f.call('/seasons/save',{...body,testId:'fake'})).status,409);
  const tested=await(await f.call('/seasons/test',body)).json();assert(tested.testId);
  assert.equal((await f.call('/seasons/save',{...body,testId:tested.testId},true,'other')).status,409);
  assert.equal((await f.call('/seasons/save',{...body,config:{...body.config,catalogSheet:'changed'},testId:tested.testId})).status,409);
  const saved=await(await f.call('/seasons/save',{...body,testId:tested.testId,makeDefault:true})).json();assert.equal(saved.defaultSeason,'2027春');
  assert.equal(f.reads(),2);assert.equal((await(await f.call('/seasons')).json()).seasons.length,1);
});
test('failed source read and stale multi-device test cannot overwrite existing configuration',async()=>{
  const f=fixture();const first={config:cfg('2026秋'),expectedRevision:0,mode:'create'};
  const t=await(await f.call('/seasons/test',first)).json();await f.call('/seasons/save',{...first,testId:t.testId});
  const second={config:cfg('2027春'),expectedRevision:1,mode:'create'};
  const t2=await(await f.call('/seasons/test',second)).json();
  const edit={config:{...cfg('2026秋'),catalogSheet:'new-catalog'},expectedRevision:1,mode:'edit'};
  const t3=await(await f.call('/seasons/test',edit,true,'other')).json();await f.call('/seasons/save',{...edit,testId:t3.testId},true,'other');
  assert.equal((await f.call('/seasons/save',{...second,testId:t2.testId})).status,409);
  const bad={config:{...cfg('2026秋'),catalogSheet:'missing'},expectedRevision:2,mode:'edit'};
  assert.equal((await f.call('/seasons/test',bad)).status,422);
  const list=await(await f.call('/seasons')).json();assert.equal(list.seasons[0].config.catalogSheet,'new-catalog');
});
test('viewers only receive season labels; private source IDs never included',async()=>{
  const f=fixture(),body={config:cfg('2026秋'),expectedRevision:0,mode:'create'};const t=await(await f.call('/seasons/test',body)).json();await f.call('/seasons/save',{...body,testId:t.testId});
  const list=await(await f.call('/seasons',undefined,false)).json();assert.equal(list.canManage,false);assert.equal(list.seasons[0].season,'2026秋');assert.equal(list.seasons[0].config,undefined);
});
test('expired test and source failure during save leave registry unchanged',async()=>{
  const f=fixture(),body={config:cfg('2027秋'),expectedRevision:0,mode:'create'};
  const tested=await(await f.call('/seasons/test',body)).json();
  const proof=f.values.get('season-test:owner');f.values.set('season-test:owner',{...proof,created:Date.now()-600001});
  assert.equal((await f.call('/seasons/save',{...body,testId:tested.testId})).status,409);
  assert.equal(f.values.has('season-registry'),false);
  const renewed=await(await f.call('/seasons/test',body)).json();
  f.registry.collect=async()=>{throw new Error('權限已變更');};
  assert.equal((await f.call('/seasons/save',{...body,testId:renewed.testId})).status,422);
  assert.equal(f.values.has('season-registry'),false);
});
