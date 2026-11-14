import {awaitingPurchase,classifyFollowUp} from '../public/order-followup.js';
import {widgetFacts,orderFacts} from './widget-facts.mjs';
import {parseTimestamp} from '../public/timestamp.js';
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const hash=async s=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));
const random=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const fail=(status,message)=>Object.assign(new Error(message),{status});
export class WidgetStore {
  constructor(storage,env){this.storage=storage;this.env=env;}
  allowed(user){
    if(!user?.sub||!String(this.env.ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).includes(user.email))throw fail(403,'此帳號沒有小工具權限');
  }
  async pair(user){
    this.allowed(user);const code=random(16),key='widget-pair:'+await hash(code),index='widget-pairs:'+await hash(user.email),expiresAt=Date.now()+300000;
    await this.storage.transaction(async tx=>{
      const keys=await tx.get(index)||[],live=[];
      for(const k of keys){const value=await tx.get(k);if(value?.expiresAt>Date.now())live.push(k);else await tx.delete(k);}
      while(live.length>=3)await tx.delete(live.shift());
      await tx.put(key,{sub:user.sub,email:user.email,expiresAt});await tx.put(index,[...live,key]);
    });
    return {code,expiresAt};
  }
  async redeem(code,ip){
    const key='widget-pair:'+await hash(String(code)),token='d77w_'+random(32),deviceKey='widget-token:'+await hash(token);
    // Fixed-size rate buckets avoid an unbounded unauthenticated key space.
    const bucket='widget-rate:'+(await hash(ip||'unknown')).slice(0,2);
    const result=await this.storage.transaction(async tx=>{
      const now=Date.now(),old=await tx.get(bucket),rate=old?.until>now?old:{count:0,until:now+60000};
      if(rate.count>=12)return {error:429};
      await tx.put(bucket,{...rate,count:rate.count+1});
      const pair=/^[a-f0-9]{32}$/.test(String(code))?await tx.get(key):null;
      if(!pair||pair.expiresAt<=now)return {error:401};
      this.allowed(pair);
      const index='widget-devices:'+await hash(pair.email),keys=await tx.get(index)||[],live=[];
      for(const k of keys){const value=await tx.get(k);if(value?.expiresAt>now)live.push(k);else await tx.delete(k);}
      while(live.length>=10)await tx.delete(live.shift());
      const expiresAt=now+30*86400000;
      await tx.put(deviceKey,{sub:pair.sub,email:pair.email,expiresAt});await tx.put(index,[...live,deviceKey]);await tx.delete(key);
      return {token,expiresAt};
    });
    if(result.error)throw fail(result.error,result.error===429?'嘗試過於頻繁，請稍後重試':'配對碼無效或已過期，請重新取得');
    return result;
  }
  async restore(token){
    if(!/^d77w_[a-f0-9]{64}$/.test(token||''))throw fail(401,'請重新配對小工具');
    const key='widget-token:'+await hash(token),record=await this.storage.get(key);
    if(!record||record.expiresAt<=Date.now())throw fail(401,'小工具登入已到期');
    this.allowed(record);return record;
  }
  async revoke(token){await this.restore(token);await this.storage.delete('widget-token:'+await hash(token));return {ok:true};}
  async revokeAll(user){
    this.allowed(user);
    await this.storage.transaction(async tx=>{
      for(const prefix of ['widget-devices:','widget-pairs:']){
        const index=prefix+await hash(user.email),keys=await tx.get(index)||[];
        for(const key of keys)await tx.delete(key);
        await tx.delete(index);
      }
    });return {ok:true};
  }
  async handle(request){
    try{
      const action=new URL(request.url).pathname.split('/').at(-1),body=await request.json();
      const result=action==='pair'?await this.pair(body.user):action==='redeem'?await this.redeem(body.code,body.ip):action==='restore'?await this.restore(body.token):action==='logout'?await this.revoke(body.token):action==='revoke'?await this.revokeAll(body.user):null;
      return Response.json(result||{error:'未知小工具操作'},{status:result?200:404});
    }catch(e){return Response.json({error:e.status?e.message:'小工具服務暫時無法使用'},{status:e.status||503});}
  }
}
const types={order:['新增訂單','orders'],change:['訂單資料已更新','orders'],activity:['協作操作已更新','orders'],shortage:['庫存狀態已更新','inventory'],rules:['中文規則已更新','rules'],stock:['庫存異動','inventory'],purchase:['下單已確認','orders'],shipment:['出貨已登記','orders'],mail:['規則已寄送','orders'],registration:['訂單待出貨登記','orders'],'rules-pending':['訂單待寄規則','orders']};
function shortcut(snapshot,event){
  const type=event.type,target=event.target;
  if(['order','rules-pending'].includes(type)&&snapshot?.orders?.some(o=>o.id===target?.id))return {type,target:{id:target.id}};
  if(['rules','shortage'].includes(type)&&snapshot?.products?.some(p=>p.name===target?.name))return {type,target:{name:target.name}};
  return {type};
}
export function widgetSummary(snapshot,events=[],stale=false,error=null){
  const counts=snapshot?{
    awaitingPurchase:snapshot.orders.filter(awaitingPurchase).length,
    awaitingShipment:snapshot.orders.filter(o=>(o.followUp||classifyFollowUp(o)).kind==='registration').length,
    awaitingRules:snapshot.orders.filter(o=>(o.followUp||classifyFollowUp(o)).kind==='rules').length,
    shortage:snapshot.products.filter(p=>p.shortage>0||p.usedShortage>0).length
  }:{awaitingPurchase:null,awaitingShipment:null,awaitingRules:null,shortage:null};
  const definitions=[['awaitingShipment','待出貨登記','orders','筆訂單等待出貨登記'],['awaitingRules','待寄中文規則','orders','筆訂單等待寄送規則'],['awaitingPurchase','待下單','orders','筆訂單尚無已確認下單量'],['shortage','缺貨待補','inventory','款品項庫存不足']];
  return {season:snapshot?.season||'',updatedAt:snapshot?.updatedAt||null,stale:!!stale,error:error?'雲端更新未完成，顯示上次資料':null,counts,
    todos:definitions.filter(([key])=>counts[key]>0).flatMap(([key,title,page])=>{
      const matching=key==='shortage'?snapshot.products.filter(p=>p.shortage>0||p.usedShortage>0):snapshot.orders.filter(o=>key==='awaitingPurchase'?awaitingPurchase(o):(o.followUp||classifyFollowUp(o)).kind===(key==='awaitingShipment'?'registration':'rules'));
      matching.sort((a,b)=>key==='shortage'?(b.shortage||0)+(b.usedShortage||0)-(a.shortage||0)-(a.usedShortage||0):(parseTimestamp(b.time)||0)-(parseTimestamp(a.time)||0));
      return matching.slice(0,8).map(o=>({title:o.name+' · '+title,body:key==='shortage'?'全新缺 '+(o.shortage??'?')+' 盒；二手缺 '+(o.usedShortage??'?')+' 盒；全新庫存 '+(o.stock??'?')+' 盒':orderFacts(o),page,time:null,...shortcut(snapshot,{type:key==='shortage'?'shortage':key==='awaitingRules'?'rules-pending':key==='awaitingPurchase'?'order':'registration',target:key==='shortage'?{name:o.name}:{id:o.id}})}));
    }),
    events:events.filter(e=>types[e.type]&&!(e.type==='stock'&&(snapshot?.transactions?.find(t=>t.id===e.target?.transactionId)?.kind==='銷貨收入'||/銷貨收入| · 出貨$/.test(e.widgetFacts?.title||'')))).slice(0,32).map(e=>{
      const facts=['order','mail'].includes(e.type)?widgetFacts(snapshot,e)||e.widgetFacts:e.widgetFacts||widgetFacts(snapshot,e);
      return {title:String(facts?.title||(e.type==='activity'&&e.title?.includes('（手機）')?e.title:types[e.type][0])).slice(0,100),body:String(facts?(e.widgetFacts?'':'目前資料：')+facts.body:e.type==='activity'&&e.title?.includes('（手機）')?e.detail:'此筆舊動態沒有詳細資料').slice(0,300),page:types[e.type][1],time:e.time,...shortcut(snapshot,e)};
    })};
}

