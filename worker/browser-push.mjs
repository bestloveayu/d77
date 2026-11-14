import {buildPushPayload} from '@block65/webcrypto-web-push';
import {digest} from './model.mjs';
import {notificationTypes} from '../public/order-followup.js';
import {dedupeEvents} from './event-dedupe.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const defaults={pushEnabled:false,quiet:true,quietStart:22,quietEnd:8,types:notificationTypes};
export const defaultPreferences=()=>({...defaults,types:[...defaults.types]});
const keyValues=env=>({publicKey:String(env.VAPID_PUBLIC_KEY||'').trim(),privateKey:String(env.VAPID_PRIVATE_KEY||'').trim()});
export async function pushKeyHealth(env){
  try{
    const {publicKey,privateKey}=keyValues(env);
    const raw=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    if(raw.length!==65||raw[0]!==4||!/^[\w-]{43}$/.test(privateKey))return {ok:false,message:'推播金鑰格式不正確 [PUSH_KEYS_FORMAT]'};
    const enc=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:enc(raw.slice(1,33)),y:enc(raw.slice(33)),d:privateKey},{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
    const pub=await crypto.subtle.importKey('raw',raw,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    const data=new TextEncoder().encode('d77-push-health');
    const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,data);
    const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pub,signature,data);
    return {ok,message:ok?'推播金鑰核對正常':'推播公私鑰不一致 [PUSH_KEYS_MISMATCH]'};
  }catch{return {ok:false,message:'推播金鑰無法使用 [PUSH_KEYS_INVALID]'};}
}
const safeErrorName=e=>['DataError','OperationError','NotSupportedError','InvalidAccessError','TypeError','TimeoutError','AbortError'].includes(e?.name)?e.name:'Error';
export function validateSubscription(value){
  let url;try{url=new URL(value?.endpoint);}catch{throw fail('裝置訂閱格式不正確');}
  const allowed=(url.hostname==='fcm.googleapis.com'&&/^\/fcm\/send\/[\w:-]+$/.test(url.pathname))||
    (url.hostname==='updates.push.services.mozilla.com'&&/^\/wpush\/v2\/[\w-]+$/.test(url.pathname))||
    (url.hostname==='web.push.apple.com'&&/^\/[\w/-]+$/.test(url.pathname));
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||!allowed||value.endpoint.length>2048)throw fail('不支援的推播服務網址');
  if(!/^[A-Za-z0-9_-]{87}$/.test(value.keys?.p256dh||'')||!/[A-Za-z0-9_-]/.test(value.keys?.auth||'')||!/^[A-Za-z0-9_-]{22}$/.test(value.keys?.auth||''))throw fail('裝置訂閱金鑰不正確');
  return {endpoint:url.href,expirationTime:null,keys:{p256dh:value.keys.p256dh,auth:value.keys.auth}};
}
export function eligibleEvents(events,prefs,created,now=Date.now()){
  if(!prefs?.pushEnabled)return [];
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'numeric',hour12:false}).format(new Date(now)));
  if(prefs.quiet&&(prefs.quietStart>prefs.quietEnd?hour>=prefs.quietStart||hour<prefs.quietEnd:hour>=prefs.quietStart&&hour<prefs.quietEnd))return [];
  return events.filter(e=>prefs.types?.includes(e.type)&&Date.parse(e.time)>created);
}
export function notificationPayload(event){
  const clean=(value,max)=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
  if(!event?.title)return {title:'東77 雲端管理',body:'有新的雲端動態，請登入查看。',page:'overview'};
  return {title:clean(event.title,100),body:clean(event.detail,240),page:['orders','inventory','rules'].includes(event.target?.page)?event.target.page:'overview'};
}
export async function sendBrowserPush(subscription,env,payload=notificationPayload()){
  let request;
  try{request=await buildPushPayload({data:JSON.stringify(payload),options:{ttl:300}},subscription,{
    subject:env.VAPID_SUBJECT||'https://bestloveayu.github.io/d77/',...keyValues(env)
  });}catch(e){throw fail('通知加密失敗 [PUSH_ENCRYPTION:'+safeErrorName(e)+']',503);}
  try{return await fetch(subscription.endpoint,{...request,redirect:'manual',signal:AbortSignal.timeout(10000)});}
  catch(e){throw fail('推播服務連線失敗 [PUSH_NETWORK:'+safeErrorName(e)+']',503);}
}
export class PushService{
  constructor(storage,env,send=sendBrowserPush){this.storage=storage;this.env=env;this.send=send;}
  available(){return !!(this.env.VAPID_PUBLIC_KEY&&this.env.VAPID_PRIVATE_KEY);}
  async status(email){
    const owner=await digest(email.toLowerCase()),rows=await this.storage.list({prefix:'webpush:device:'});
    const health=this.available()?await pushKeyHealth(this.env):{ok:false,message:'推播服務尚未設定'};
    return {available:health.ok,publicKey:health.ok?keyValues(this.env).publicKey:null,health,devices:[...rows.values()].filter(r=>r.owner===owner).length};
  }
  async device(email,body){
    if(!this.available())throw fail('瀏覽器推播尚未啟用',503);
    if(!['register','status','remove','test'].includes(body.op))throw fail('裝置操作不正確');
    const subscription=validateSubscription(body.subscription),id=await digest(subscription.endpoint),key='webpush:device:'+id,owner=await digest(email.toLowerCase());
    const old=await this.storage.get(key),owned=old?.owner===owner;
    if(body.op==='status')return {subscribed:owned};
    if(body.op==='remove'){if(owned)await this.storage.delete(key);return {ok:true};}
    if(body.op==='register'){
      if(old&&!owned)throw fail('此裝置已由其他帳號啟用，請先停用原訂閱',409);
      if(!old&&(await this.status(email)).devices>=5)throw fail('每個帳號最多啟用五個裝置',409);
      await this.storage.put(key,{owner,email:email.toLowerCase(),subscription,created:old?.created||Date.now(),delivered:old?.delivered||[],pending:old?.pending||[],lastTest:old?.lastTest||0});
      return {ok:true};
    }
    if(!owned)throw fail('請先在此裝置啟用通知',409);
    if(Date.now()-old.lastTest<60000)throw fail('請稍候一分鐘再測試',429);
    old.lastTest=Date.now();await this.storage.put(key,old);
    let response;try{response=await this.send(subscription,this.env);}catch(e){throw fail(e.status===503?e.message:'測試通知傳送失敗 [PUSH_SEND_ERROR]',503);}
    if([404,410].includes(response.status))await this.storage.delete(key);
    if(!response.ok)throw fail([404,410].includes(response.status)?'此裝置訂閱已失效，請停用後重新啟用 [PUSH_EXPIRED]':`推播服務拒絕測試 [PUSH_HTTP_${response.status}]`,503);
    return {ok:true};
  }
  async deliver(events,preferences){
    if(!this.available())return;
    const allowed=String(this.env.ALLOWED_EMAILS||'').split(',').map(s=>s.trim().toLowerCase());
    const rows=await this.storage.list({prefix:'webpush:device:'});
    for(const [key,record] of rows){
      try{
        if(!allowed.includes(record.email)){await this.storage.delete(key);continue;}
        const prefs=await preferences(record.email),now=Date.now();
        const pending=new Map([...(record.pending||[]),...dedupeEvents(events).map(e=>({id:e.id,type:e.type,time:e.time,payload:notificationPayload(e)}))].map(e=>[e.id,e]));
        record.pending=prefs?.pushEnabled?[...pending.values()].filter(e=>Date.parse(e.time)>record.created&&Date.parse(e.time)>now-86400000&&!record.delivered?.includes(e.id)&&prefs.types?.includes(e.type)).slice(-150):[];
        await this.storage.put(key,record);
        const eligible=eligibleEvents(record.pending,prefs,record.created);
        if(!eligible.length)continue;
        if(record.nextTry>now)continue;
        record.failures=(record.failures||0)+1;record.nextTry=now+Math.min(900000,60000*2**Math.min(record.failures-1,4));
        await this.storage.put(key,record);
        const latest=[...eligible].sort((a,b)=>Date.parse(b.time)-Date.parse(a.time))[0];
        const response=await this.send(validateSubscription(record.subscription),this.env,latest.payload||notificationPayload());
        if([404,410].includes(response.status))await this.storage.delete(key);
        else if(response.ok){
          const ids=new Set(eligible.map(e=>e.id));record.delivered=[...(record.delivered||[]),...ids].slice(-300);
          record.pending=record.pending.filter(e=>!ids.has(e.id));record.nextTry=0;record.failures=0;await this.storage.put(key,record);
        }else await this.storage.put('webpush:error',{message:'部分裝置推播未送達，通知中心仍保留動態',time:new Date().toISOString()});
      }catch{await this.storage.put('webpush:error',{message:'部分裝置推播失敗，通知中心仍保留動態',time:new Date().toISOString()});}
    }
  }
}
