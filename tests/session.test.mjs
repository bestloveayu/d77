import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionStore,SESSION_TTL} from '../worker/session.mjs';
import {createWorker,BoardStore} from '../worker/index.mjs';

function fixture(){
  const values=new Map();let queue=Promise.resolve();
  const storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),delete:async k=>values.delete(k),transaction:fn=>{const p=queue.then(()=>fn(storage));queue=p.catch(()=>{});return p;}};
  const env={ALLOWED_EMAILS:'owner@gmail.com',ALLOWED_ORIGIN:'https://board.test'};
  const board=new BoardStore({storage},env);env.BOARD={idFromName:n=>n,get:n=>{assert.equal(n,'shared-v1');return {fetch:(url,init)=>board.fetch(new Request(url,init))};}};
  let googleCalls=0;const worker=createWorker(async request=>{googleCalls++;if(request.headers.get('Authorization')!=='Bearer google')throw Object.assign(new Error('invalid'),{status:401});return {sub:'123',email:'owner@gmail.com'};});
  const call=(path,method='GET',token='google',headers={})=>worker.fetch(new Request('https://api.test'+path,{method,headers:{Authorization:'Bearer '+token,...headers}}),env);
  return {values,storage,env,call,googleCalls:()=>googleCalls};
}
test('Google-only issuance, restore, existing endpoints, fixed TTL, and revocation',async()=>{
  const f=fixture(),before=Date.now();const r=await f.call('/session','POST');assert.equal(r.status,200);
  const s=await r.json();assert.match(s.token,/^d77s_[a-f0-9]{64}$/);assert.equal(s.viewer,'owner@gmail.com');assert(s.expiresAt>=before+SESSION_TTL);
  assert(!JSON.stringify([...f.values]).includes(s.token));
  const restored=await new SessionStore(f.storage,f.env).restore(s.token);assert.equal(restored.expiresAt,s.expiresAt);assert.equal(restored.sub,'123');
  assert.deepEqual(await(await f.call('/session','GET',s.token)).json(),{viewer:s.viewer,expiresAt:s.expiresAt});
  assert.equal((await f.call('/preferences','GET',s.token)).status,200);
  assert.equal((await f.call('/preferences')).status,200);
  assert.equal((await f.call('/session','POST',s.token)).status,401);
  assert.equal((await f.call('/session','GET','google')).status,401);
  assert.equal((await f.call('/session/logout','POST',s.token)).status,200);
  assert.equal((await f.call('/session','GET',s.token)).status,401);
});
test('tampering, expiration, and allowlist removal reject without Google fallback',async()=>{
  const f=fixture(),s=await(await f.call('/session','POST')).json();const calls=f.googleCalls();
  assert.equal((await f.call('/session','GET',s.token.slice(0,-1)+(s.token.endsWith('0')?'1':'0'))).status,401);
  f.env.ALLOWED_EMAILS='other@gmail.com';assert.equal((await f.call('/preferences','GET',s.token)).status,403);
  f.env.ALLOWED_EMAILS='owner@gmail.com';
  for(const [k,v] of f.values)if(k.startsWith('session:'))f.values.set(k,{...v,expiresAt:Date.now()-1});
  assert.equal((await f.call('/session','GET',s.token)).status,401);assert.equal(f.googleCalls(),calls);
});
test('bounded concurrent issuance evicts oldest and cleans expired records',async()=>{
  const f=fixture(),store=new SessionStore(f.storage,f.env);const user={sub:'123',email:'owner@gmail.com'};
  const issued=await Promise.all(Array.from({length:12},()=>store.issue(user)));
  assert.equal([...f.values.keys()].filter(k=>k.startsWith('session:')).length,10);
  await assert.rejects(()=>store.restore(issued[0].token),{status:401});
  for(const [k,v] of f.values)if(k.startsWith('session:'))f.values.set(k,{...v,expiresAt:0});
  await store.issue(user);assert.equal([...f.values.keys()].filter(k=>k.startsWith('session:')).length,1);
});
test('route methods, private routes, CORS and no cookies',async()=>{
  const f=fixture();for(const [path,method] of [['/session','PUT'],['/session/logout','GET'],['/session/logout','DELETE']])assert.equal((await f.call(path,method)).status,405);
  assert.equal((await f.call('/internal/session/issue','POST')).status,404);
  assert.equal((await f.call('/session','POST','google',{Origin:'https://evil.test'})).status,403);
  const r=await f.call('/session','POST');assert.equal(r.headers.get('Set-Cookie'),null);assert.equal(r.headers.get('Cache-Control'),'no-store');
  assert.equal((await f.call('/session','POST','google',{'Content-Length':'8193'})).status,413);
});
