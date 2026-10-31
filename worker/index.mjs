import { authenticate, collect } from './google.mjs';
import { changes, digest } from './model.mjs';
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin');
    const cors={'Access-Control-Allow-Origin':env.ALLOWED_ORIGIN,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
    if(origin&&origin!==env.ALLOWED_ORIGIN)return json({error:'來源不允許'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    const path=new URL(request.url).pathname;
    if(!['/snapshot','/refresh','/notifications','/read','/preferences'].includes(path))return json({error:'找不到端點'},404,cors);
    try{
      const user=await authenticate(request,env);
      if((path==='/snapshot'||path==='/notifications')&&request.method!=='GET')return json({error:'方法不允許'},405,cors);
      if(!['/snapshot','/notifications','/preferences'].includes(path)&&request.method!=='POST')return json({error:'方法不允許'},405,cors);
      if(path==='/preferences'&&!['GET','POST'].includes(request.method))return json({error:'方法不允許'},405,cors);
      if(Number(request.headers.get('Content-Length')||0)>8192)return json({error:'請求過大'},413,cors);
      const body=request.method==='POST'?await request.text():'';
      if(body.length>8192)return json({error:'請求過大'},413,cors);
      const stub=env.BOARD.get(env.BOARD.idFromName('shared-v1'));
      const response=await stub.fetch('https://internal'+path,{method:request.method,headers:{'Content-Type':'application/json','X-User':user.sub,'X-Email':user.email},...(body?{body}:{})});
      return new Response(response.body,{status:response.status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
    }catch(e){return json({error:e.status?e.message:'登入驗證失敗，請重新登入'},e.status||401,cors);}
  },
  async scheduled(event,env,ctx){
    ctx.waitUntil(env.BOARD.get(env.BOARD.idFromName('shared-v1')).fetch('https://internal/refresh',{method:'POST',headers:{'X-Scheduled':'1'}}));
  }
};
export class BoardStore {
  constructor(ctx,env){this.ctx=ctx;this.env=env;this.pending=null;}
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
  async update(){
    if(this.pending)return this.pending;
    this.pending=(async()=>{
      const last=await this.ctx.storage.get('lastAttempt');
      if(last&&Date.now()-last<60000)return;
      await this.ctx.storage.put('lastAttempt',Date.now());
      try{
        const next=await collect(this.env),previous=await this.snapshot();
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
        await this.push(incoming);
      }catch(e){await this.ctx.storage.put('error',{message:e.message,time:new Date().toISOString()});}
    })().finally(()=>{this.pending=null;});
    return this.pending;
  }
  async push(events){
    // Optional ntfy integration. Disabled until an individual explicitly opts in.
    let targets;try{targets=JSON.parse(this.env.NTFY_TARGETS||'{}');}catch{return;}
    for(const [email,target] of Object.entries(targets)){
      const key='prefs:'+await digest(email.toLowerCase()),prefs=await this.ctx.storage.get(key);
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
    if(path==='/refresh'){
      await this.update();return json({ok:true,error:await this.ctx.storage.get('error')||null});
    }
    if(!user||!email)return json({error:'需要登入'},401);
    if(path==='/snapshot'){
      if(!await this.ctx.storage.get('snapshot-meta'))await this.update();
      const snapshot=await this.snapshot(),error=await this.ctx.storage.get('error');
      return json({snapshot:snapshot||null,error:error||null,viewer:email,stale:!snapshot||Date.now()-Date.parse(snapshot.updatedAt)>600000});
    }
    if(path==='/notifications'){
      const read=new Set(await this.ctx.storage.get('read:'+user)||[]);
      const events=await this.events();
      return json({events:events.map(e=>({...e,read:read.has(e.id)})),pushError:await this.ctx.storage.get('pushError')||null});
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
        if(typeof body.pushEnabled!=='boolean'||typeof body.quiet!=='boolean'||![body.quietStart,body.quietEnd].every(x=>Number.isInteger(x)&&x>=0&&x<=23)||!Array.isArray(body.types)||body.types.some(t=>!['order','change','shortage','rules','activity'].includes(t)))return json({error:'通知設定格式不正確'},400);
        await this.ctx.storage.put(key,{pushEnabled:body.pushEnabled,quiet:body.quiet,quietStart:body.quietStart,quietEnd:body.quietEnd,types:body.types});
      }
      let targets={};try{targets=JSON.parse(this.env.NTFY_TARGETS||'{}');}catch{}
      return json({preferences:await this.ctx.storage.get(key)||{pushEnabled:false,quiet:true,quietStart:22,quietEnd:8,types:['order','change','shortage','rules','activity']},pushAvailable:!!targets[email]});
    }
    return json({error:'找不到端點'},404);
  }
}
