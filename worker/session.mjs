export const SESSION_TTL=30*24*60*60*1000;
const fail=(status=401)=>Object.assign(new Error(status===403?'此帳號沒有看板存取權限':'請重新登入'),{status});
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const hash=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
export const sessionBearer=request=>request.headers.get('Authorization')?.match(/^Bearer (d77s_[A-Za-z0-9._-]*)$/)?.[1];
export class SessionStore {
  constructor(storage,env){this.storage=storage;this.env=env;}
  allowed(user){
    const allowed=String(this.env.ALLOWED_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    if(!user?.sub||!user.email?.endsWith('@gmail.com')||!allowed.includes(user.email))throw fail(403);
  }
  async issue(user){
    this.allowed(user);
    const token='d77s_'+hex(crypto.getRandomValues(new Uint8Array(32))),key='session:'+await hash(token),index='session-index:'+await hash(user.email);
    const expiresAt=Date.now()+SESSION_TTL;
    await this.storage.transaction(async tx=>{
      const ids=await tx.get(index)||[],live=[];
      for(const id of ids){const record=await tx.get(id);if(record?.expiresAt>Date.now())live.push(id);else await tx.delete(id);}
      while(live.length>=10)await tx.delete(live.shift());
      await tx.put(key,{sub:user.sub,email:user.email,expiresAt});await tx.put(index,[...live,key]);
    });
    return {token,expiresAt,viewer:user.email};
  }
  async restore(token){
    if(!/^d77s_[a-f0-9]{64}$/.test(token||''))throw fail();
    const key='session:'+await hash(token),record=await this.storage.get(key);
    if(!record)throw fail();
    if(record.expiresAt<=Date.now()){await this.revoke(token);throw fail();}
    this.allowed(record);return record;
  }
  async revoke(token){
    if(!/^d77s_[a-f0-9]{64}$/.test(token||''))throw fail();
    const key='session:'+await hash(token);
    await this.storage.transaction(async tx=>{
      const record=await tx.get(key);if(!record)return;
      const index='session-index:'+await hash(record.email),ids=(await tx.get(index)||[]).filter(id=>id!==key);
      await tx.delete(key);if(ids.length)await tx.put(index,ids);else await tx.delete(index);
    });
  }
  async handle(request){
    try{
      const path=new URL(request.url).pathname;
      if(request.method!=='POST')return Response.json({error:'方法不允許'},{status:405});
      if(path==='/internal/session/issue')return Response.json(await this.issue(await request.json()));
      const {token}=await request.json();
      if(path==='/internal/session/restore')return Response.json(await this.restore(token));
      if(path==='/internal/session/logout'){await this.restore(token);await this.revoke(token);return Response.json({ok:true});}
      return Response.json({error:'找不到端點'},{status:404});
    }catch(e){if(!e.status)throw e;return Response.json({error:e.message},{status:e.status});}
  }
}
export async function sessionCall(env,action,body){
  return env.BOARD.get(env.BOARD.idFromName('shared-v1')).fetch('https://internal/internal/session/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
}
