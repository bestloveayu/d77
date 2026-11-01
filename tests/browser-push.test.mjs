import test from 'node:test';
import assert from 'node:assert/strict';
import {PushService,validateSubscription,eligibleEvents,sendBrowserPush} from '../worker/browser-push.mjs';
import {generateKeyPairSync,createECDH,randomBytes} from 'node:crypto';
const sub=(id='one')=>({endpoint:'https://fcm.googleapis.com/fcm/send/'+id,keys:{p256dh:'B'+ 'A'.repeat(86),auth:'A'.repeat(22)}});
test('real library encrypts generic content and signs VAPID; redirects are forbidden',async()=>{
 const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=privateKey.export({format:'jwk'});
 const pub=Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]).toString('base64url');
 const client=createECDH('prime256v1');client.generateKeys();const subscription={...sub(),keys:{p256dh:client.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
 const original=globalThis.fetch;let sent;
 globalThis.fetch=async(url,options)=>{sent={url,options};return new Response(null,{status:201});};
 try{await sendBrowserPush(subscription,{VAPID_PUBLIC_KEY:pub,VAPID_PRIVATE_KEY:jwk.d});}
 finally{globalThis.fetch=original;}
 assert.equal(sent.options.redirect,'error');assert.equal(sent.options.method.toUpperCase(),'POST');
 const headers=new Headers(sent.options.headers);assert.equal(headers.get('content-encoding'),'aes128gcm');assert.match(headers.get('authorization'),/^vapid /);
 assert.ok(sent.options.body.byteLength>100);assert.ok(!Buffer.from(sent.options.body).includes(Buffer.from('cloud-update')));
});
function fixture(){const values=new Map();const store={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),delete:async k=>values.delete(k),list:async({prefix})=>new Map(structuredClone([...values].filter(([k])=>k.startsWith(prefix))))};let sends=0,status=201;const env={VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_KEY:'private',ALLOWED_EMAILS:'a,b'};const service=new PushService(store,env,async()=>{sends++;return new Response(null,{status});});return {service,values,env,get sends(){return sends;},set status(v){status=v;}};}
test('reject arbitrary, credentials, redirects-by-host and malformed subscription destinations',()=>{
  assert.equal(validateSubscription(sub()).endpoint,sub().endpoint);
  for(const endpoint of ['http://fcm.googleapis.com/fcm/send/x','https://localhost/x','https://fcm.googleapis.com.evil.test/x','https://u:p@fcm.googleapis.com/fcm/send/x','https://fcm.googleapis.com:8443/x'])assert.throws(()=>validateSubscription({...sub(),endpoint}));
  assert.throws(()=>validateSubscription({...sub(),keys:{auth:'x',p256dh:'x'}}));
});
test('revoking an account removes its subscription before sending',async()=>{
 const f=fixture();await f.service.device('a',{op:'register',subscription:sub()});f.env.ALLOWED_EMAILS='b';
 await f.service.deliver([{id:'one',type:'order',time:new Date(Date.now()+100).toISOString()}],async()=>({pushEnabled:true,types:['order']}));
 assert.equal(f.sends,0);assert.equal((await f.service.status('a')).devices,0);
});
test('transient failures stay pending and retry on a later empty refresh',async()=>{
 const f=fixture();await f.service.device('a',{op:'register',subscription:sub()});f.status=503;
 const prefs=async()=>({pushEnabled:true,types:['order']});
 await f.service.deliver([{id:'retry',type:'order',time:new Date(Date.now()+100).toISOString()}],prefs);
 const key=[...f.values.keys()].find(k=>k.startsWith('webpush:device:')),record=f.values.get(key);
 assert.equal(record.pending.length,1);record.nextTry=0;f.values.set(key,record);f.status=201;
 await f.service.deliver([],prefs);assert.equal(f.sends,2);assert.equal(f.values.get(key).pending.length,0);
});
test('subscriptions are isolated, limited, and removable only by owner',async()=>{
 const f=fixture();await f.service.device('a',{op:'register',subscription:sub()});
 await assert.rejects(()=>f.service.device('b',{op:'register',subscription:sub()}));
 assert.equal((await f.service.device('b',{op:'status',subscription:sub()})).subscribed,false);
 await f.service.device('b',{op:'remove',subscription:sub()});
 assert.equal((await f.service.device('a',{op:'status',subscription:sub()})).subscribed,true);
 for(let i=2;i<=5;i++)await f.service.device('a',{op:'register',subscription:sub(String(i))});
 await assert.rejects(()=>f.service.device('a',{op:'register',subscription:sub('6')}));
 await f.service.device('a',{op:'remove',subscription:sub()});
 assert.equal((await f.service.device('a',{op:'status',subscription:sub()})).subscribed,false);
});
test('test delivery is rate limited and expired endpoints removed',async()=>{
 const f=fixture();await f.service.device('a',{op:'register',subscription:sub()});
 await f.service.device('a',{op:'test',subscription:sub()});assert.equal(f.sends,1);
 await assert.rejects(()=>f.service.device('a',{op:'test',subscription:sub()}));
 const g=fixture();await g.service.device('a',{op:'register',subscription:sub()});g.status=410;
 await assert.rejects(()=>g.service.device('a',{op:'test',subscription:sub()}));
 assert.equal((await g.service.device('a',{op:'status',subscription:sub()})).subscribed,false);
});
test('quiet hours, event types, and subscription age prevent unsolicited history',()=>{
 const now=Date.parse('2026-11-01T04:00:00Z'),event={id:'x',type:'order',time:new Date(now).toISOString()};
 const p={pushEnabled:true,quiet:true,quietStart:22,quietEnd:8,types:['order']};
 assert.equal(eligibleEvents([event],p,now-1,now).length,1);
 assert.equal(eligibleEvents([event],p,now+1,now).length,0);
 assert.equal(eligibleEvents([event],{...p,pushEnabled:false},0,now).length,0);
 assert.equal(eligibleEvents([event],{...p,types:['rules']},0,now).length,0);
 assert.equal(eligibleEvents([event],p,0,Date.parse('2026-11-01T15:00:00Z')).length,0);
});
test('new event batches deliver once; disabled users receive nothing; errors isolated',async()=>{
 const f=fixture();await f.service.device('a',{op:'register',subscription:sub()});
 const event={id:'event',type:'order',time:new Date(Date.now()+100).toISOString()};
 const prefs=async()=>({pushEnabled:true,quiet:false,types:['order']});
 await f.service.deliver([event],prefs);await f.service.deliver([event],prefs);assert.equal(f.sends,1);
 await f.service.deliver([{...event,id:'two'}],async()=>({pushEnabled:false}));assert.equal(f.sends,1);
 await f.service.deliver([{...event,id:'three'}],prefs);await f.service.deliver([event],prefs);assert.equal(f.sends,2);
});

