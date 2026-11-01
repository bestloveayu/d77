import {buildPushPayload} from '@block65/webcrypto-web-push';
import {digest} from './model.mjs';
import {notificationTypes} from '../public/order-followup.js';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const defaults={pushEnabled:false,quiet:true,quietStart:22,quietEnd:8,types:notificationTypes};
export const defaultPreferences=()=>({...defaults,types:[...defaults.types]});
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
export async function sendBrowserPush(subscription,env){
  const request=await buildPushPayload({data:'cloud-update',options:{ttl:300}},subscription,{
    subject:env.VAPID_SUBJECT||'https://bestloveayu.github.io/d77/',publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY
  });
  return fetch(subscription.endpoint,{...request,redirect:'error',signal:AbortSignal.timeout(10000)});
}
export class PushService{
  constructor(storage,env,send=sendBrowserPush){this.storage=storage;this.env=env;this.send=send;}
  available(){return !!(this.env.VAPID_PUBLIC_KEY&&this.env.VAPID_PRIVATE_KEY);}
  async status(email){
    const owner=await digest(email.toLowerCase()),rows=await this.storage.list({prefix:'webpush:device:'});
    return {available:this.available(),publicKey:this.available()?this.env.VAPID_PUBLIC_KEY:null,devices:[...rows.values()].filter(r=>r.owner===owner).length};
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
    let response;try{response=await this.send(subscription,this.env);}catch{throw fail('測試通知未送達，請稍後重試',503);}
    if([404,410].includes(response.status))await this.storage.delete(key);
    if(!response.ok)throw fail('推播服務未接受測試，請停用後重新啟用',503);
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
        const pending=new Map([...(record.pending||[]),...events.map(({id,type,time})=>({id,type,time}))].map(e=>[e.id,e]));
        record.pending=prefs?.pushEnabled?[...pending.values()].filter(e=>Date.parse(e.time)>record.created&&Date.parse(e.time)>now-86400000&&!record.delivered?.includes(e.id)&&prefs.types?.includes(e.type)).slice(-150):[];
        await this.storage.put(key,record);
        const eligible=eligibleEvents(record.pending,prefs,record.created);
        if(!eligible.length)continue;
        if(record.nextTry>now)continue;
        record.failures=(record.failures||0)+1;record.nextTry=now+Math.min(900000,60000*2**Math.min(record.failures-1,4));
        await this.storage.put(key,record);
        const response=await this.send(validateSubscription(record.subscription),this.env);
        if([404,410].includes(response.status))await this.storage.delete(key);
        else if(response.ok){
          const ids=new Set(eligible.map(e=>e.id));record.delivered=[...(record.delivered||[]),...ids].slice(-300);
          record.pending=record.pending.filter(e=>!ids.has(e.id));record.nextTry=0;record.failures=0;await this.storage.put(key,record);
        }else await this.storage.put('webpush:error',{message:'部分裝置推播未送達，通知中心仍保留動態',time:new Date().toISOString()});
      }catch{await this.storage.put('webpush:error',{message:'部分裝置推播失敗，通知中心仍保留動態',time:new Date().toISOString()});}
    }
  }
}

