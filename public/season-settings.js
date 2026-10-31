import {normalizeConfig,SOURCE_DEFAULTS} from './season-config.js';
const $=s=>document.querySelector(s);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=n=>`<i data-lucide="${n}" aria-hidden="true"></i>`;
export function showSeasonSettings(ctx){
  const state=ctx.getState();
  ctx.openDialog('季別與來源',`<div class="source-intro"><span class="badge ${ctx.demo?'warn':'good'}">${ctx.demo?'示範設定 · 不讀寫真實雲端':'只修改看板讀取來源'}</span>${state.canManage?'<button class="primary" id="season-add">'+icon('plus')+'新增季別</button>':''}</div><div class="season-list">${state.seasons.map(s=>`<section class="season-entry"><div><h3>${esc(s.season)}</h3><div class="badges">${s.season===state.defaultSeason?'<span class="badge good">預設通知季別</span>':''}<span class="badge">${s.testedAt?'連線已測試':'初始來源'}</span></div>${s.config?`<p>${esc(s.config.catalogSheet)}</p><p>${esc(s.config.responseSheet)}</p>`:''}</div>${state.canManage?`<button class="icon-button" data-season-edit="${esc(s.season)}" title="編輯 ${esc(s.season)} 來源" aria-label="編輯 ${esc(s.season)} 來源">${icon('pencil')}</button>`:''}</section>`).join('')||'<p class="empty">尚未新增季別來源</p>'}</div>${!state.canManage?'<p class="read-only-note">來源設定由管理者維護。</p>':''}`);
  $('#season-add')?.addEventListener('click',()=>editSeason(ctx));
  document.querySelectorAll('[data-season-edit]').forEach(b=>b.onclick=()=>editSeason(ctx,state.seasons.find(s=>s.season===b.dataset.seasonEdit)));
}
function editSeason(ctx,entry){
  const state=ctx.getState(),mode=entry?'edit':'create';
  const latest=[...state.seasons].sort((a,b)=>(Number(b.season.slice(0,4))*2+(b.season.endsWith('秋')?1:0))-(Number(a.season.slice(0,4))*2+(a.season.endsWith('秋')?1:0)))[0]?.season;
  const next=latest?(latest.endsWith('春')?latest.slice(0,4)+'秋':String(Number(latest.slice(0,4))+1)+'春'):new Date().getFullYear()+'春';
  const c=entry?.config||{...SOURCE_DEFAULTS,season:next,spreadsheetId:'',catalogSheet:'',responseSheet:next+'預購回應',rulesFolderId:'',aliases:{},productColumns:{}};
  const year=c.season.slice(0,4),period=c.season.slice(4);
  const field=(key,label,value,placeholder='',required=true)=>`<label class="source-field"><span>${label}</span><input name="${key}" value="${esc(value)}" ${required?'required':''} placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false"></label>`;
  ctx.openDialog(entry?'編輯 '+entry.season+' 來源':'新增季別',`<form id="season-form" class="source-form"><div class="source-form-top"><button type="button" id="season-back" class="text-button">${icon('arrow-left')}返回季別</button><span class="badge ${ctx.demo?'warn':''}">${ctx.demo?'示範模式':'管理者設定'}</span></div><div class="source-year"><label class="source-field"><span>年份</span><input name="year" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required value="${year}" ${entry?'readonly':''}></label><label class="source-field"><span>季別</span><select name="period" ${entry?'disabled':''}><option value="春" ${period==='春'?'selected':''}>春季 GM</option><option value="秋" ${period==='秋'?'selected':''}>秋季 GM</option></select></label></div>
  ${field('spreadsheetId','Google 試算表網址／ID',c.spreadsheetId,'貼上試算表網址')}
  ${field('catalogSheet','品項統計分頁名稱',c.catalogSheet,'例如：2027春品項統計')}
  ${field('responseSheet','預購回應分頁名稱',c.responseSheet,'例如：2027春預購回應')}
  ${field('rulesFolderId','中文規則資料夾網址／ID',c.rulesFolderId,'貼上 Google Drive 資料夾網址')}
  <details class="source-advanced"><summary>進階來源設定</summary><div>
  ${field('ledgerSheet','金流分頁',c.ledgerSheet)}${field('teamSheet','協作分頁',c.teamSheet)}${field('documentsSheet','手動訂單與寄送紀錄分頁',c.documentsSheet)}
  <label class="source-field"><span>品項名稱對照（JSON）</span><textarea name="aliases" rows="3" spellcheck="false">${esc(JSON.stringify(c.aliases||{},null,2))}</textarea></label>
  <label class="source-field"><span>商品欄位設定（JSON）</span><textarea name="productColumns" rows="3" spellcheck="false">${esc(JSON.stringify(c.productColumns||{},null,2))}</textarea></label></div></details>
  <label class="field source-default"><span>設為預設通知季別</span><input type="checkbox" name="makeDefault" ${state.defaultSeason===c.season||!state.seasons.length?'checked':''}></label>
  <div id="source-test-result" role="status" aria-live="polite"></div>
  <div class="source-actions"><button id="source-test" type="button">${icon('plug-zap')}測試連線</button><button id="source-save" type="submit" class="primary" disabled>${icon('check')}確認儲存來源</button></div></form>`);
  const form=$('#season-form');let tested=null,working=false;
  const result=$('#source-test-result'),testButton=$('#source-test'),saveButton=$('#source-save');
  const readConfig=()=>{
    const values=Object.fromEntries(new FormData(form));
    return normalizeConfig({season:values.year+(entry?period:values.period),spreadsheetId:values.spreadsheetId,catalogSheet:values.catalogSheet,responseSheet:values.responseSheet,rulesFolderId:values.rulesFolderId,ledgerSheet:values.ledgerSheet,teamSheet:values.teamSheet,documentsSheet:values.documentsSheet,aliases:values.aliases,productColumns:values.productColumns});
  };
  const status=(text,kind='')=>{result.className=kind?'source-result '+kind:'';result.textContent=text;};
  const lock=active=>{working=active;for(const e of form.querySelectorAll('input,textarea,select,button'))e.disabled=active;form.querySelector('[name=period]').disabled=active||!!entry;saveButton.disabled=active||!tested;form.setAttribute('aria-busy',String(active));};
  form.addEventListener('input',e=>{if(e.target.name==='makeDefault')return;if(tested){tested=null;saveButton.disabled=true;status('設定已修改，請重新測試連線','warn');}});
  form.addEventListener('change',e=>{if(e.target.name==='makeDefault')return;if(tested){tested=null;saveButton.disabled=true;status('設定已修改，請重新測試連線','warn');}});
  $('#season-back').onclick=()=>{if(!working)showSeasonSettings(ctx);};
  testButton.onclick=async()=>{
    if(working||!form.reportValidity())return;
    let config;try{config=readConfig();}catch(e){tested=null;saveButton.disabled=true;status(e.message,'bad');return;}
    tested=null;lock(true);status(ctx.demo?'正在測試示範來源…':'正在核對雲端分頁與規則資料夾…');
    try{
      let response;
      if(ctx.demo){await new Promise(r=>setTimeout(r,400));if(mode==='create'&&state.seasons.some(s=>s.season===config.season))throw new Error('此季別已存在，請返回季別清單編輯');if(config.catalogSheet==='不存在')throw new Error('示範測試：找不到指定分頁，未儲存');response={testId:crypto.randomUUID(),summary:{orders:0,rulesTotal:0,rulesReady:0},testedAt:new Date().toISOString()};}
      else response=await ctx.api('/seasons/test',{config,expectedRevision:state.revision,mode});
      if(!form.isConnected)return;
      tested={...response,config,created:Date.now()};result.className='source-result good';result.innerHTML=`<strong>${icon('circle-check')}${ctx.demo?'示範連線測試通過':'連線測試通過'}</strong><dl><div><dt>訂單</dt><dd>${num(response.summary.orders)}</dd></div><div><dt>品項</dt><dd>${num(response.summary.rulesTotal)}</dd></div><div><dt>中文規則</dt><dd>${num(response.summary.rulesReady)}</dd></div></dl>`;ctx.icons();
    }catch(e){if(form.isConnected)status(e.message,'bad');}
    finally{if(form.isConnected)lock(false);}
  };
  form.onsubmit=async e=>{
    e.preventDefault();if(working||!tested||!form.reportValidity())return;
    let config;try{config=readConfig();}catch(err){status(err.message,'bad');return;}
    if(JSON.stringify(config)!==JSON.stringify(tested.config)||Date.now()-tested.created>600000){tested=null;saveButton.disabled=true;status('測試結果已失效，請重新測試連線','warn');return;}
    const makeDefault=form.querySelector('[name=makeDefault]').checked;lock(true);status('正在重新核對並儲存來源…');
    try{
      if(ctx.demo)ctx.saveDemo({config,mode,makeDefault});
      else await ctx.api('/seasons/save',{config,mode,makeDefault,expectedRevision:state.revision,testId:tested.testId});
      await ctx.onSaved(config.season);if(form.isConnected)showSeasonSettings(ctx);
    }catch(err){if(form.isConnected){tested=null;status(err.message,'bad');}}
    finally{if(form.isConnected)lock(false);}
  };
}
const num=value=>Number.isFinite(Number(value))?Number(value):'—';
