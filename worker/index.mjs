import { authenticate, collect } from './google.mjs';
import {SessionStore,sessionBearer,sessionCall} from './session.mjs';
import { changes, digest } from './model.mjs';
import {SeasonRegistry} from './seasons.mjs';
import {PushService,defaultPreferences} from './browser-push.mjs';
import {displayEvent} from './notification-display.mjs';
import {notificationTypes} from '../public/order-followup.js';
import {WidgetStore,widgetSummary} from './widget.mjs';
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export const seasonObjectName=entry=>'season:'+entry.season+':'+entry.configDigest;
async function seasonTarget(env,season,user){
  const registry=env.BOARD.get(env.BOARD.idFromName('shared-v1'));
  const response=await registry.fetch('https://internal/internal/config'+(season?'?season='+encodeURIComponent(season):''),{headers:{'X-User':user}});
  if(!response.ok)return {error:response};
  const entry=await response.json();
  return {stub:env.BOARD.get(env.BOARD.idFromName(seasonObjectName(entry))),entry};
}
export function createWorker(authenticateGoogle=authenticate){return {
  async fetch(request,env){
    const origin=request.headers.get('Origin');
    const cors={'Access-Control-Allow-Origin':env.ALLOWED_ORIGIN,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
    if(origin&&origin!==env.ALLOWED_ORIGIN)return json({error:'來源不允許'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    const url=new URL(request.url),path=url.pathname;
    if(!['/session','/session/logout','/snapshot','/refresh','/notifications','/read','/preferences','/push/status','/push/device','/seasons','/seasons/test','/seasons/save','/widget/pair','/widget/redeem','/widget/revoke','/widget/logout','/widget/data'].includes(path))return json({error:'找不到端點'},404,cors);
    if(['/widget/redeem','/widget/data','/widget/logout'].includes(path)){
      const expected=path==='/widget/data'?'GET':'POST';if(request.method!==expected)return json({error:'方法不允許'},405,cors);
      try{
        const shared=env.BOARD.get(env.BOARD.idFromName('shared-v1'));
        const call=(action,body)=>shared.fetch('https://internal/internal/widget/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        if(path==='/widget/redeem'){
          if(Number(request.headers.get('Content-Length')||0)>512)return json({error:'請求過大'},413,cors);
          const raw=await request.text();if(raw.length>512)return json({error:'請求過大'},413,cors);
          let body;try{body=JSON.parse(raw);}catch{return json({error:'配對格式不正確'},400,cors);}
          const response=await call('redeem',{code:body.code,ip:request.headers.get('CF-Connecting-IP')||'unknown'});
          return json(await response.json(),response.status,cors);
        }
        const widgetToken=request.headers.get('Authorization')?.match(/^Bearer (d77w_[a-f0-9]{64})$/)?.[1];
        const restored=await call(path==='/widget/logout'?'logout':'restore',{token:widgetToken});
        const user=await restored.json();if(!restored.ok||path==='/widget/logout')return json(user,restored.status,cors);
        const target=await seasonTarget(env,null,user.sub);if(target.error)return json({error:'尚未設定預設季別'},503,cors);
        const headers={'X-User':user.sub,'X-Email':user.email,'X-Source-Config':JSON.stringify(target.entry.config),'X-Notify':target.entry.isDefault?'1':'0'};
        const response=await target.stub.fetch('https://internal/snapshot',{headers:{...headers,'X-Widget-Cached':'1'}});
        if(!response.ok)return json({error:'雲端資料暫時無法取得'},503,cors);
        const data=await response.json();
        const eventsResponse=await target.stub.fetch('https://internal/notifications',{headers});
        const events=eventsResponse.ok?(await eventsResponse.json()).events:[];
        return json(widgetSummary(data.snapshot,events,data.stale,data.error),200,cors);
      }catch{return json({error:'小工具暫時無法更新，請稍後重試'},503,cors);}
    }
    const isSession=path==='/session'||path==='/session/logout',token=sessionBearer(request);
    if(isSession&&!(path==='/session'?['GET','POST']:['POST']).includes(request.method))return json({error:'方法不允許'},405,cors);
    const wrap=response=>new Response(response.body,{status:response.status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    let user;try{
      if(isSession&&request.method==='POST'&&(Number(request.headers.get('Content-Length')||0)>8192||(await request.text()).length>8192))return json({error:'請求過大'},413,cors);
      if(path==='/session'&&request.method==='POST'){
        if(token)return json({error:'請使用 Google 重新登入'},401,cors);
        user=await authenticateGoogle(request,env);
        return wrap(await sessionCall(env,'issue',user));
      }
      if(token){
        const response=await sessionCall(env,path==='/session/logout'?'logout':'restore',{token});
        if(response.status===403)return json({error:'此帳號沒有看板存取權限',code:'AUTH_FORBIDDEN'},403,cors);
        if(!response.ok||path==='/session/logout')return wrap(response);
        user=await response.json();
        if(path==='/session')return json({viewer:user.email,expiresAt:user.expiresAt},200,cors);
      }else{
        if(isSession)return json({error:'請使用應用程式登入憑證'},401,cors);
        user=await authenticateGoogle(request,env);
      }
    }catch(e){return json({error:e.status?e.message:'登入驗證失敗，請重新登入',...(e.status===403?{code:'AUTH_FORBIDDEN'}:{})},e.status||401,cors);}
    try{
      if(['/snapshot','/notifications','/seasons','/push/status'].includes(path)&&request.method!=='GET')return json({error:'方法不允許'},405,cors);
      if(!['/snapshot','/notifications','/preferences','/seasons','/push/status'].includes(path)&&request.method!=='POST')return json({error:'方法不允許'},405,cors);
      if(path==='/preferences'&&!['GET','POST'].includes(request.method))return json({error:'方法不允許'},405,cors);
      const limit=path.startsWith('/seasons/')?32000:8192;
      if(Number(request.headers.get('Content-Length')||0)>limit)return json({error:'請求過大'},413,cors);
      const body=request.method==='POST'?await request.text():'';
      if(body.length>limit)return json({error:'請求過大'},413,cors);
      if(path==='/widget/pair'||path==='/widget/revoke'){
        const response=await env.BOARD.get(env.BOARD.idFromName('shared-v1')).fetch('https://internal/internal/widget/'+path.split('/').at(-1),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:{sub:user.sub,email:user.email}})});
        return json(await response.json(),response.status,cors);
      }
      const admins=String(env.ADMIN_EMAILS||env.ALLOWED_EMAILS?.split(',')[0]||'').split(',').map(s=>s.trim().toLowerCase());
      let stub=env.BOARD.get(env.BOARD.idFromName('shared-v1')),entry;
      if(!path.startsWith('/seasons')&&!path.startsWith('/push/')&&path!=='/preferences'){
        const season=url.searchParams.get('season');if(season&&!/^\d{4}[春秋]$/.test(season))return json({error:'季別格式不正確'},400,cors);
        const target=await seasonTarget(env,season,user.sub);
        if(target.error)return new Response(target.error.body,{status:target.error.status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
        stub=target.stub;entry=target.entry;
      }
      const response=await stub.fetch('https://internal'+path,{method:request.method,headers:{'Content-Type':'application/json','X-User':user.sub,'X-Email':user.email,'X-Manager':admins.includes(user.email)?'1':'0',...(entry?{'X-Source-Config':JSON.stringify(entry.config),'X-Notify':entry.isDefault?'1':'0'}:{})},...(body?{body}:{})});
      return new Response(response.body,{status:response.status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
    }catch{return json({error:'看板服務暫時無法處理，原資料未變更，請稍後重試'},503,cors);}
  },
  async scheduled(event,env,ctx){
    ctx.waitUntil((async()=>{const target=await seasonTarget(env,null,'scheduler');if(!target.error)await target.stub.fetch('https://internal/refresh',{method:'POST',headers:{'X-Source-Config':JSON.stringify(target.entry.config),'X-Notify':'1'}});})());
  }
};}
export default createWorker();
export class BoardStore {
  constructor(ctx,env){this.ctx=ctx;this.env=env;this.pending=null;this.pushQueue=Promise.resolve();}
  async snapshot(){
    const meta=await this.ctx.storage.get('snapshot-meta');if(!meta)return null;
    let raw='';for(let i=0;i<meta.count;i++){const part=await this.ctx.storage.get('snapshot:'+i);if(typeof part!=='string')throw new Error('雲端快照不完整');raw+=part;}
    return JSON.parse(raw);
  }
  async events(){
    const ids=await this.ctx.storage.get('event-index')||[];
    const values=await Promise.all(ids.map(id=>this.ctx.storage.get('event:'+id)));
    return values.filter(Boolean);
  }
  async update(sourceConfig,notify=false){
    if(this.pending)return this.pending;
    this.pending=(async()=>{
      const last=await this.ctx.storage.get('lastAttempt');
      if(last&&Date.now()-last<60000)return;
      await this.ctx.storage.put('lastAttempt',Date.now());
      try{
        const next=await collect(this.env,sourceConfig),previous=await this.snapshot();
        const incoming=await changes(previous,next);
        const existing=await this.events();
        await this.ctx.storage.transaction(async tx=>{
          const unique=new Map([...incoming,...existing].map(e=>[e.id,e]));
          const merged=[...unique.values()].sort((a,b)=>b.time.localeCompare(a.time)).slice(0,150);
          for(const event of merged)await tx.put('event:'+event.id,event);
          for(const event of existing)if(!merged.some(e=>e.id===event.id))await tx.delete('event:'+event.id);
          await tx.put('event-index',merged.map(e=>e.id));
          const raw=JSON.stringify(next),count=Math.ceil(raw.length/16000),old=await tx.get('snapshot-meta');
          for(let i=0;i<count;i++)await tx.put('snapshot:'+i,raw.slice(i*16000,(i+1)*16000));
          for(let i=count;i<(old?.count||0);i++)await tx.delete('snapshot:'+i);
          await tx.put('snapshot-meta',{count});await tx.delete('error');
        });
        if(notify)await this.push(incoming);
      }catch(e){await this.ctx.storage.put('error',{message:e.message,time:new Date().toISOString()});}
    })().finally(()=>{this.pending=null;});
    return this.pending;
  }
  async push(events){
    // Device delivery is independent from business reads and never changes orders.
    try{
      await this.env.BOARD.get(this.env.BOARD.idFromName('shared-v1')).fetch('https://internal/internal/push',{method:'POST',body:JSON.stringify({events})});
    }catch{await this.ctx.storage.put('pushError',{message:'手機推播未送達；通知中心紀錄已保留',time:new Date().toISOString()});}
    // Optional ntfy integration. Disabled until an individual explicitly opts in.
    let targets;try{targets=JSON.parse(this.env.NTFY_TARGETS||'{}');}catch{return;}
    for(const [email,target] of Object.entries(targets)){
      const settings=await this.env.BOARD.get(this.env.BOARD.idFromName('shared-v1')).fetch('https://internal/preferences',{headers:{'X-User':'push-service','X-Email':email}});
      const prefs=(await settings.json()).preferences;
      if(!prefs?.pushEnabled||!target.url?.startsWith('https://'))continue;
      const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'numeric',hour12:false}).format(new Date()));
      if(prefs.quiet&&((prefs.quietStart>prefs.quietEnd&&(hour>=prefs.quietStart||hour<prefs.quietEnd))||(prefs.quietStart<=prefs.quietEnd&&hour>=prefs.quietStart&&hour<prefs.quietEnd)))continue;
      for(const event of events){
        if(prefs.types&&!prefs.types.includes(event.type))continue;
        const delivered='push:'+await digest([email,event.id]);
        if(await this.ctx.storage.get(delivered))continue;
        try{
          // Push is deliberately generic: never send names, contact details, or order totals.
          const response=await fetch(target.url,{method:'POST',headers:{'Content-Type':'text/plain; charset=utf-8',...(target.token?{Authorization:'Bearer '+target.token}:{})},body:'東77 有新的雲端動態，請登入看板查看。',signal:AbortSignal.timeout(10000)});
          if(response.ok)await this.ctx.storage.put(delivered,true);
          else await this.ctx.storage.put('pushError',{message:'手機推播未送達；通知中心紀錄已保留',time:new Date().toISOString()});
        }catch{await this.ctx.storage.put('pushError',{message:'手機推播連線失敗；通知中心紀錄已保留',time:new Date().toISOString()});}
      }
    }
  }
  async fetch(request){
    const path=new URL(request.url).pathname,user=request.headers.get('X-User'),email=request.headers.get('X-Email');
    if(path.startsWith('/internal/session/'))return new SessionStore(this.ctx.storage,this.env).handle(request);
    if(path.startsWith('/internal/widget/'))return new WidgetStore(this.ctx.storage,this.env).handle(request);
    if(path.startsWith('/seasons')||path==='/internal/config')return new SeasonRegistry(this.ctx.storage,this.env,collect).handle(request);
    const push=new PushService(this.ctx.storage,this.env);
    const exclusive=fn=>{const task=this.pushQueue.then(fn);this.pushQueue=task.catch(()=>{});return task;};
    if(path==='/internal/push'){
      const {events}=await request.json();
      await exclusive(()=>push.deliver(events,async address=>await this.ctx.storage.get('prefs:'+await digest(address))||defaultPreferences()));
      return json({ok:true});
    }
    let sourceConfig;try{sourceConfig=JSON.parse(request.headers.get('X-Source-Config')||'null');}catch{return json({error:'來源設定無效'},400);}
    const notify=request.headers.get('X-Notify')==='1';
    if(path==='/refresh'){
      await this.update(sourceConfig,notify);return json({ok:true,error:await this.ctx.storage.get('error')||null});
    }
    if(!user||!email)return json({error:'需要登入'},401);
    if(path==='/push/status')return json(await push.status(email));
    if(path==='/push/device'){
      try{return json(await exclusive(async()=>push.device(email,await request.json())));}
      catch(e){return json({error:e.status?e.message:'裝置訂閱處理失敗'},e.status||400);}
    }
    if(path==='/snapshot'){
      const current=await this.snapshot();
      if(!current||Date.now()-Date.parse(current.updatedAt)>300000){
        if(request.headers.get('X-Widget-Cached')==='1'&&this.ctx.waitUntil){
          // A widget must not hold its mobile connection open while Google is refreshed.
          this.ctx.waitUntil(this.update(sourceConfig,notify));
          const error=await this.ctx.storage.get('error');
          return json({snapshot:current,error:error||null,stale:true,refreshing:true});
        }
        await this.update(sourceConfig,notify);
      }
      const snapshot=await this.snapshot(),error=await this.ctx.storage.get('error');
      return json({snapshot:snapshot||null,error:error||null,viewer:email,stale:!!error||!snapshot||Date.now()-Date.parse(snapshot.updatedAt)>600000});
    }
    if(path==='/notifications'){
      const read=new Set(await this.ctx.storage.get('read:'+user)||[]);
      const events=await this.events(),snapshot=await this.snapshot();
      return json({events:events.map(e=>({...displayEvent(e,snapshot),read:read.has(e.id)})),pushError:await this.ctx.storage.get('pushError')||null});
    }
    if(path==='/read'){
      const body=await request.json(),events=await this.events();
      if(!Array.isArray(body.ids)||body.ids.length>300||body.ids.some(id=>!events.some(e=>e.id===id)))return json({error:'通知識別碼無效'},400);
      const allowed=new Set(events.map(e=>e.id));
      const read=[...new Set([...(await this.ctx.storage.get('read:'+user)||[]),...body.ids])].filter(id=>allowed.has(id));
      await this.ctx.storage.put('read:'+user,read);return json({ok:true});
    }
    if(path==='/preferences'){
      const key='prefs:'+await digest(email.toLowerCase());
      if(request.method==='POST'){
        const body=await request.json();
        if(typeof body.pushEnabled!=='boolean'||typeof body.quiet!=='boolean'||![body.quietStart,body.quietEnd].every(x=>Number.isInteger(x)&&x>=0&&x<=23)||!Array.isArray(body.types)||body.types.some(t=>!notificationTypes.includes(t)))return json({error:'通知設定格式不正確'},400);
        await this.ctx.storage.put(key,{pushEnabled:body.pushEnabled,quiet:body.quiet,quietStart:body.quietStart,quietEnd:body.quietEnd,types:body.types});
      }
      let targets={};try{targets=JSON.parse(this.env.NTFY_TARGETS||'{}');}catch{}
      return json({preferences:await this.ctx.storage.get(key)||defaultPreferences(),pushAvailable:push.available()||!!targets[email]});
    }
    return json({error:'找不到端點'},404);
  }
}

