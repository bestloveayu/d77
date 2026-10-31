import {normalizeConfig} from '../public/season-config.js';
import {digest} from './model.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export class SeasonRegistry{
  constructor(storage,env,collect){this.storage=storage;this.env=env;this.collect=collect;}
  async state(){
    const saved=await this.storage.get('season-registry');if(saved)return saved;
    let config;try{config=normalizeConfig(JSON.parse(this.env.SHEET_CONFIG||'null'));}catch{}
    return {revision:0,defaultSeason:config?.season||'',seasons:config?[{season:config.season,config,configDigest:await digest(config),testedAt:null}]:[]};
  }
  async handle(request){
    const path=new URL(request.url).pathname,admin=request.headers.get('X-Manager')==='1',user=request.headers.get('X-User');
    if(!user)return json({error:'需要登入'},401);
    if(path==='/internal/config'){
      const state=await this.state(),season=new URL(request.url).searchParams.get('season')||state.defaultSeason;
      const entry=state.seasons.find(s=>s.season===season);
      return entry?json({...entry,isDefault:season===state.defaultSeason}):json({error:'尚未設定此季別來源，請至季別設定新增'},404);
    }
    if(path==='/seasons'){
      const state=await this.state();return json({...state,canManage:admin,seasons:state.seasons.map(s=>admin?s:{season:s.season,testedAt:s.testedAt})});
    }
    if(!admin)return json({error:'只有管理者可以修改季別讀取來源'},403);
    if(!['/seasons/test','/seasons/save'].includes(path)||request.method!=='POST')return json({error:'方法不允許'},405);
    let body,config;try{body=await request.json();config=normalizeConfig(body.config);}catch(e){return json({error:e.message||'設定格式不正確'},400);}
    const state=await this.state(),existing=state.seasons.find(s=>s.season===config.season);
    if(body.expectedRevision!==state.revision)return json({error:'另一台已更新季別設定，請重新載入後再測試'},409);
    if(!['create','edit'].includes(body.mode)||(body.mode==='create'&&existing)||(body.mode==='edit'&&!existing))return json({error:'季別已存在或已變更，請重新載入設定'},409);
    if(!existing&&state.seasons.length>=24)return json({error:'季別設定已達 24 季上限'},400);
    const hash=await digest(config),key='season-test:'+user;
    if(path==='/seasons/test'){
      try{
        const snapshot=await this.collect(this.env,config);
        const test={id:crypto.randomUUID(),configDigest:hash,expectedRevision:state.revision,user,mode:body.mode,created:Date.now()};
        await this.storage.put(key,test);
        return json({testId:test.id,testedAt:new Date(test.created).toISOString(),summary:snapshot.summary,season:config.season,expiresIn:600});
      }catch(e){await this.storage.delete(key);return json({error:e.message||'雲端來源測試失敗，未儲存'},422);}
    }
    const tested=await this.storage.get(key);
    if(!tested||tested.id!==body.testId||tested.user!==user||tested.configDigest!==hash||tested.mode!==body.mode||tested.expectedRevision!==state.revision||Date.now()-tested.created>600000)return json({error:'測試結果已失效或設定已修改，請重新測試連線'},409);
    try{await this.collect(this.env,config);}catch(e){return json({error:e.message||'來源重新核對失敗，未儲存'},422);}
    return this.storage.transaction(async tx=>{
      const latest=await tx.get('season-registry')||state;
      const proof=await tx.get(key);
      if(latest.revision!==state.revision||proof?.id!==tested.id)return json({error:'設定版本已改變，請重新測試'},409);
      const record={season:config.season,config,configDigest:hash,testedAt:new Date().toISOString(),updatedBy:request.headers.get('X-Email')};
      const seasons=[...latest.seasons.filter(s=>s.season!==config.season),record].sort((a,b)=>b.season.localeCompare(a.season));
      const saved={revision:latest.revision+1,defaultSeason:body.makeDefault===true||!latest.defaultSeason?config.season:latest.defaultSeason,seasons};
      if(new TextEncoder().encode(JSON.stringify(saved)).length>100000)return json({error:'季別來源設定過大，請減少進階欄位設定後重試'},400);
      await tx.put('season-registry',saved);await tx.delete(key);
      return json({revision:saved.revision,defaultSeason:saved.defaultSeason,savedSeason:config.season});
    });
  }
}
