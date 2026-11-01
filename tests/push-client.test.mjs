import test from 'node:test';import assert from 'node:assert/strict';
import {createPushClient} from '../public/push.js';
function fixture(permission='granted'){
 const calls=[];let current=null,unsubscribed=0,requested=0;
 const manager={getSubscription:async()=>current,subscribe:async()=>current={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'key',auth:'key'},toJSON(){return {endpoint:this.endpoint,keys:this.keys};},unsubscribe:async()=>{unsubscribed++;current=null;return true;}}};
 const registration={pushManager:manager};
 const browser={isSecureContext:true,PushManager:class{},Notification:{permission,requestPermission:async()=>{requested++;return permission;}},navigator:{serviceWorker:{getRegistration:async()=>registration,register:async()=>registration,ready:Promise.resolve(registration)}}};
 let reject=false;const api=async(path,body)=>{calls.push([path,body]);if(reject&&body?.op==='register')throw Error('network');return path==='/push/status'?{available:true,publicKey:'BAAA'}:{subscribed:!!current,ok:true};};
 return {client:createPushClient(api,browser),browser,calls,set reject(v){reject=v;},get unsubscribed(){return unsubscribed;},get requested(){return requested;}};
}
test('unsupported browsers and denied permissions never subscribe',async()=>{
 const unsupported=createPushClient(()=>{},{});assert.equal(unsupported.supported(),false);await assert.rejects(()=>unsupported.enable());
 const f=fixture('denied');await assert.rejects(()=>f.client.enable());assert.equal(f.requested,1);assert.equal(f.calls.length,0);
});
test('enable, test, disable and logout cleanup use only current subscription',async()=>{
 const f=fixture();await f.client.enable();assert.equal(f.requested,1);assert.equal(f.calls.at(-1)[1].op,'register');
 await f.client.test();assert.equal(f.calls.at(-1)[1].op,'test');
 await f.client.disable();assert.equal(f.calls.at(-1)[1].op,'remove');assert.equal(f.unsubscribed,1);
});
test('registration failure rolls back newly created browser subscription',async()=>{
 const f=fixture();f.reject=true;await assert.rejects(()=>f.client.enable());assert.equal(f.unsubscribed,1);
});
test('a stale session cannot register a newly created subscription',async()=>{
 let active=true,registered=false,unsubscribed=false;
 const sub={toJSON:()=>({endpoint:'fixture'}),unsubscribe:async()=>{unsubscribed=true;}};
 const reg={pushManager:{getSubscription:async()=>null,subscribe:async()=>{active=false;return sub;}}};
 const browser={isSecureContext:true,Notification:{requestPermission:async()=> 'granted'},PushManager:class{},navigator:{serviceWorker:{register:async()=>reg,ready:Promise.resolve(reg)}}};
 const client=createPushClient(async(path,body)=>{if(body?.op==='register')registered=true;return {available:true,publicKey:'BAAA'};},browser,{isCurrent:()=>active});
 await assert.rejects(()=>client.enable());assert.equal(registered,false);assert.equal(unsubscribed,true);
});
test('status does not request permission; service worker has no business cache',async()=>{
 const f=fixture();await f.client.status();assert.equal(f.requested,0);
 const text=await(await import('node:fs/promises')).readFile(new URL('../public/sw.js',import.meta.url),'utf8');
 assert.ok(!/caches\.|addEventListener\(['"]fetch/.test(text));assert.ok(text.includes('notificationclick'));
});

