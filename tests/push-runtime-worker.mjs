import {buildPushPayload} from '@block65/webcrypto-web-push';
import {pushKeyHealth,sendBrowserPush} from '../worker/browser-push.mjs';
const encoded=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export default {async fetch(){try{
 const vapid=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',vapid.privateKey),publicKey=encoded(await crypto.subtle.exportKey('raw',vapid.publicKey));
 const client=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/runtime-test',keys:{p256dh:encoded(await crypto.subtle.exportKey('raw',client.publicKey)),auth:encoded(crypto.getRandomValues(new Uint8Array(16)))}};
 const request=await buildPushPayload({data:'cloud-update',options:{ttl:300}},subscription,{subject:'https://bestloveayu.github.io/d77/',publicKey,privateKey:jwk.d});
 const health=await pushKeyHealth({VAPID_PUBLIC_KEY:publicKey,VAPID_PRIVATE_KEY:jwk.d});
 const originalFetch=globalThis.fetch;let redirect;
 globalThis.fetch=async(url,init)=>{const outbound=new Request(url,init);redirect=outbound.redirect;return new Response(null,{status:201});};
 let result;try{result=await sendBrowserPush(subscription,{VAPID_PUBLIC_KEY:publicKey,VAPID_PRIVATE_KEY:jwk.d});}finally{globalThis.fetch=originalFetch;}
 return Response.json({ok:health.ok&&result.ok&&redirect==='manual',length:request.body.byteLength,health:health.message,redirect});
}catch(e){return Response.json({ok:false,name:e.name,error:e.message});}}};

