import {demoSnapshot,demoEvents} from './demo.js';
import {showSeasonSettings} from './season-settings.js';
import {SOURCE_DEFAULTS} from './season-config.js';
import {stageLabel,orderProgressLabels} from './order-status.js';
import {installSwipe} from './swipe.js';
const $=s=>document.querySelector(s),config=window.BOARD_CONFIG||{};
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n==null?'待核對':'$'+Number(n).toLocaleString('zh-TW');
const num=n=>n==null?'—':n;
const badge=(text,kind='')=>`<span class="badge ${kind}">${esc(text)}</span>`;
const progressBadges=o=>orderProgressLabels(o).map(p=>badge(p.text,p.good?'good':'')).join('');
const names={overview:'營運總覽',orders:'顧客訂單',inventory:'庫存查詢',rules:'規則進度',notifications:'通知中心'};
const eventIcon={order:'clipboard-list',change:'git-compare-arrows',shortage:'triangle-alert',rules:'book-open',activity:'package-check'};
let data=null,events=[],token='',account='',demo=false,stale=false,busy=false,error='',page='overview',filter='all',search='',sort='new',timer;
let selectedSeason=localStorage.getItem('d77-season')||'',requestEpoch=0;
let seasonState={revision:0,defaultSeason:'',seasons:[],canManage:false};
const demoEventStore=new Map();
function demoSources(){return {revision:0,defaultSeason:'2026秋',canManage:true,seasons:['2026秋','2026春'].map(season=>({season,config:{season,spreadsheetId:'sample-book',catalogSheet:season+'品項統計',responseSheet:season+'預購回應',rulesFolderId:'sample-folder',...SOURCE_DEFAULTS,aliases:{},productColumns:{}},testedAt:new Date().toISOString()}))};}
function demoData(season){const value=demoSnapshot();value.season=season;if(season!=='2026秋'){value.orders=[];value.products=[];value.summary={orders:0,attention:0,shortages:0,unknownStock:0,rulesReady:0,rulesTotal:0};value.finance={income:0,cost:0,profit:0};}return value;}
function seasonEvents(season){if(!demoEventStore.has(season))demoEventStore.set(season,season==='2026秋'?demoEvents():[]);return demoEventStore.get(season);}
const icons=()=>window.lucide?.createIcons();
function links(p){return `<div class="rule-links">${p?.rules?.map(f=>f.url?`<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${icon(f.cards?'files':'file-text')}${f.cards?'卡表':'規則檔'}${icon('arrow-up-right')}</a>`:`<span class="muted">${f.cards?'卡表':'規則檔'} · 示意</span>`).join('')||''}</div>`;}
function empty(text){return `<div class="empty">${icon('inbox')}${esc(text)}</div>`;}
function setError(message){error=message||'';$('#error').hidden=!error;$('#error').textContent=error;}
function showWorkspace(){
  $('#login').hidden=true;$('#workspace').hidden=false;$('#nav').hidden=false;$('#demo-label').hidden=!demo;
  page=names[location.hash.slice(1)]?location.hash.slice(1):'overview';render();
}
function chrome(){
  $('#page-title').textContent=names[page];
  const select=$('#season-select');select.innerHTML=seasonState.seasons.length?seasonState.seasons.map(s=>`<option value="${esc(s.season)}">${esc(s.season)}</option>`).join(''):'<option value="">未設定季別</option>';select.value=selectedSeason;select.disabled=busy||!seasonState.seasons.length;
  $('#sync-status').textContent=demo?'示範模式 · 未連接雲端':data?`${stale?'資料可能過期':'雲端資料已讀取'} · ${new Date(data.updatedAt).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'尚無成功讀取資料';
  document.querySelectorAll('#nav a').forEach(a=>{a.classList.toggle('active',a.dataset.page===page);a.setAttribute('aria-current',a.dataset.page===page?'page':'false');});
  const unread=events.filter(e=>!e.read).length;$('#unread').hidden=!unread;$('#unread').textContent=unread>99?'99+':unread;
  $('#refresh').disabled=busy;$('#refresh').classList.toggle('spin',busy);setError(error);
}
function heading(title,action){return `<div class="section-heading"><h2>${title}</h2>${action||''}</div>`;}
function overview(){
  const s=data.summary;
  const stats=[['clipboard-list','訂單數',s.orders,''],['clock-3','待處理',s.attention,''],['package-open','缺貨品項',s.shortages,'warn'],['book-open-check','規則已備齊',`${s.rulesReady}/${s.rulesTotal}`,'']];
  const low=data.products.filter(p=>p.shortage>0).slice(0,4);
  const due=data.finance.eastDue;
  const dueText=due==null?'待核對':Math.round(due*100)===0?'已平衡':due<0?'于應給東':'東應給于';
  return `<section class="section overview-finance" aria-label="本季收支">${heading(esc(data.season)+' · 本季收支')}<div class="finance finance-overview"><div><small>收入</small><strong>${money(data.finance.income)}</strong></div><div><small>成本</small><strong>${money(data.finance.cost)}</strong></div><div><small>結餘</small><strong>${money(data.finance.profit)}</strong></div><div class="season-due"><small>${dueText}</small><strong>${due==null?'待核對':money(Math.abs(due))}</strong></div></div></section>
  <div class="metrics">${stats.map(([i,label,count,kind])=>`<div class="metric ${kind}">${icon(i)}<div><span class="metric-label">${label}</span><strong>${count}</strong></div></div>`).join('')}</div>
  <section class="section">${heading('待辦提醒')}
    <button class="alert-row warn" data-go="inventory" data-filter="shortage">${icon('triangle-alert')}<span class="text"><strong>${s.shortages} 款遊戲待補貨</strong><small>依已確認未出貨需求與帳面庫存計算</small></span>${icon('chevron-right')}</button>
    <button class="alert-row" data-go="rules" data-filter="ready">${icon('book-open-check')}<span class="text"><strong>${s.rulesReady} 款中文規則已備齊</strong><small>查看訂購顧客與規則寄送狀態</small></span>${icon('chevron-right')}</button>
    ${s.unknownStock?`<button class="alert-row warn" data-go="inventory" data-filter="unknown">${icon('circle-help')}<span class="text"><strong>${s.unknownStock} 款出貨證據待確認</strong><small>未將未知狀態當成零或缺貨</small></span>${icon('chevron-right')}</button>`:''}
  </section>
  <section class="section">${heading('缺貨清單',`<button class="text-button" data-go="inventory">查看全部 ${icon('chevron-right')}</button>`)}${stockTable(low)}</section>
  <section class="section">${heading('最新動態',`<button class="text-button" data-go="notifications">查看全部 ${icon('chevron-right')}</button>`)}${eventList(events.slice(0,3))}</section>`;
}
function filters(placeholder,options,sortOptions){return `<div class="filters"><label class="search">${icon('search')}<input id="search" type="search" aria-label="${placeholder}" placeholder="${placeholder}" value="${esc(search)}" autocomplete="off"></label>${sortOptions?`<select id="sort" aria-label="排序">${sortOptions.map(([value,label])=>`<option value="${value}" ${sort===value?'selected':''}>${label}</option>`).join('')}</select>`:''}</div><div class="segments">${options.map(([value,label])=>`<button data-filter="${value}" class="${filter===value?'active':''}" aria-pressed="${filter===value}">${label}</button>`).join('')}</div>`;}
function parseTime(value){
  let text=String(value||'').replace(/上午\s*/,'AM ').replace(/下午\s*/,'PM ');
  const m=String(value||'').match(/(\d{4})\/(\d+)\/(\d+)\s*(上午|下午)?\s*(\d+):(\d+)(?::(\d+))?/);
  if(m){let h=Number(m[5]);if(m[4]==='下午'&&h<12)h+=12;if(m[4]==='上午'&&h===12)h=0;text=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T${String(h).padStart(2,'0')}:${m[6]}:${m[7]||'00'}+08:00`;}
  return Date.parse(text)||0;
}
function ordersView(){
  let rows=data.orders.filter(o=>(o.name+' '+(o.nickname||'')+' '+o.lines.map(l=>l.name).join(' ')).toLowerCase().includes(search.toLowerCase()));
  if(filter==='pending')rows=rows.filter(o=>o.status!=='已出貨');if(filter==='done')rows=rows.filter(o=>o.status==='已出貨');
  rows=[...rows].sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh-TW'):(parseTime(a.time)-parseTime(b.time))*(sort==='old'?1:-1));
  return filters('搜尋顧客、品項',[['all','全部'],['pending','待處理'],['done','已出貨']],[['new','填單時間新到舊'],['old','填單時間舊到新'],['name','依姓名']])+`<div class="count-line"><span>共 ${rows.length} 筆訂單</span><span>依原始訂單分列</span></div>`+
  (rows.map(o=>`<article class="order"><div class="order-top"><div><button class="order-name" data-order="${esc(o.id)}">${esc(o.name||'姓名待核對')}${icon('chevron-right')}</button><p class="order-meta">${esc(o.nickname||'')}${o.nickname?' · ':''}${o.manual?'手動訂單':esc(o.time||'填單時間未記錄')}</p></div><strong>${money(o.total)}</strong></div><div class="badges">${badge(o.status,o.status==='已出貨'?'good':o.status==='待核對'?'bad':'warn')}${progressBadges(o)}${o.manual?badge('手動追加'):''}${o.phoneSuffix?badge('手機末碼 '+o.phoneSuffix):''}</div><div class="order-items">${o.lines.map(l=>`<span class="order-item">${icon('package')}${esc(l.name)} × ${num(l.quantity)}</span>`).join('')}</div></article>`).join('')||empty('沒有符合條件的訂單'));
}
function stockTable(rows){return rows.length?`<div class="stock-head"><span>品項</span><span>待出</span><span>庫存</span><span>缺貨</span><span></span></div>${rows.map(p=>`<div class="stock-row"><button class="order-name stock-name" data-product="${esc(p.name)}">${esc(p.name)}</button><span class="num">${num(p.outstanding)}</span><span class="num">${p.stock}</span><span class="num ${p.shortage>0?'deficit':''}">${num(p.shortage)}</span><button class="icon-button" data-product="${esc(p.name)}" aria-label="查看 ${esc(p.name)}" title="查看品項">${icon('chevron-right')}</button></div>`).join('')}`:empty('目前沒有符合條件的品項');}
function inventoryView(){
  let rows=data.products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
  if(filter==='shortage')rows=rows.filter(p=>p.shortage>0);if(filter==='used')rows=rows.filter(p=>p.usedStock!==0);if(filter==='unknown')rows=rows.filter(p=>p.coverage==='unknown');
  rows=[...rows].sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh-TW'):sort==='stock'?a.stock-b.stock:(b.shortage??-1)-(a.shortage??-1));
  return filters('搜尋品項',[['all','全部'],['shortage','缺貨'],['used','二手'],['unknown','待確認']],[['new','缺貨多到少'],['name','依名稱'],['stock','庫存少到多']])+stockTable(rows)+`<p class="read-only-note">${icon('info')} 庫存依歷年雲端金流計算。「—」表示出貨證據不足，未推算缺貨。二手量於品項明細分列。</p>`;
}
function rulesView(){
  let rows=data.products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
  if(filter==='ready')rows=rows.filter(p=>p.rules.length);if(filter==='pending')rows=rows.filter(p=>!p.rules.length);
  rows=[...rows].sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh-TW'):(b.ordered||0)-(a.ordered||0));
  return filters('搜尋遊戲',[['all','全部'],['pending','待備齊'],['ready','已完成']],[['new','訂購量多到少'],['name','依名稱']])+`<div class="info-band">${icon('book-open-check')} 已備齊 ${data.summary.rulesReady} / ${data.summary.rulesTotal} 款</div>`+
  (rows.map(p=>`<article class="rule-row"><div class="rule-art">${icon(p.rules.length?'book-open-check':'book-open')}</div><div class="rule-main"><h3>${esc(p.name)}</h3>${badge(p.rules.length?'已完成':'尚無中文規則',p.rules.length?'good':'warn')}${links(p)}<p class="rule-meta">訂購 ${num(p.ordered)} 盒 · 對應 ${p.customers.length} 筆訂單</p></div><button class="icon-button" data-rule="${esc(p.name)}" title="查看訂購" aria-label="查看 ${esc(p.name)} 訂購顧客">${icon('chevron-right')}</button></article>`).join('')||empty('沒有符合條件的規則'));
}
function eventList(rows){return rows.length?rows.map(e=>`<article class="event ${e.read?'':'unread'}"><span class="event-icon">${icon(eventIcon[e.type]||'bell')}</span><div class="event-main"><button data-event="${esc(e.id)}">${esc(e.title)}</button><p>${esc(e.detail)}</p><p>${new Date(e.time).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</p></div></article>`).join(''):empty('目前沒有新通知');}
function notificationsView(){return `<div class="section-heading"><span class="muted">最近 150 則</span><button id="read-all" class="text-button">${icon('check-check')}全部已讀</button></div><div class="segments"><button data-filter="all" class="${filter==='all'?'active':''}">全部</button><button data-filter="unread" class="${filter==='unread'?'active':''}">未讀</button></div>${eventList(events.filter(e=>filter!=='unread'||!e.read))}`;}
function render(){
  if(!data){$('#view').innerHTML=empty('尚無成功讀取資料，請檢查雲端連線設定');chrome();icons();return;}
  const position=window.scrollY;$('#view').innerHTML=({overview,orders:ordersView,inventory:inventoryView,rules:rulesView,notifications:notificationsView}[page])();chrome();icons();
  $('#search')?.addEventListener('input',e=>{const cursor=e.target.selectionStart;search=e.target.value;render();const s=$('#search');s?.focus();try{s?.setSelectionRange(cursor,cursor);}catch{}window.scrollTo(0,position);});
  $('#sort')?.addEventListener('change',e=>{sort=e.target.value;render();});
}
async function api(path,body){
  if(!config.apiBase||!token)throw new Error('請先完成登入與雲端設定');
  const endpoint=new URL(config.apiBase.replace(/\/$/,'')+path);if(selectedSeason&&!path.startsWith('/seasons')&&path!=='/preferences')endpoint.searchParams.set('season',selectedSeason);
  const response=await fetch(endpoint,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:AbortSignal.timeout(60000)});
  const result=await response.json();if(!response.ok){if(response.status===401){logout();throw new Error('登入已過期，請重新登入');}throw new Error(result.error||'讀取失敗');}return result;
}
async function refresh(force=false){
  if(busy)return;const epoch=++requestEpoch;busy=true;chrome();
  try{if(demo){data=demoData(selectedSeason);events=seasonEvents(selectedSeason);error='';return;}
    const list=await api('/seasons');if(epoch!==requestEpoch||!token)return;seasonState=list;
    if(!list.seasons.some(s=>s.season===selectedSeason))selectedSeason=list.defaultSeason||list.seasons[0]?.season||'';
    if(!selectedSeason){data=null;events=[];error='尚未設定季別來源，請到設定新增季別。';return;}
    const requested=selectedSeason;
    if(force)await api('/refresh',{});
    const result=await api('/snapshot');if(epoch!==requestEpoch||requested!==selectedSeason)return;
    stale=result.stale;error=result.error?.message||'';if(result.viewer)account=result.viewer;
    if(result.snapshot){if(result.snapshot.season!==requested)throw new Error('回應季別不一致，未顯示資料');data=result.snapshot;}else data=null;
    const notifications=await api('/notifications');if(epoch!==requestEpoch||requested!==selectedSeason)return;events=notifications.events;
  }catch(e){if(epoch===requestEpoch){error=e.name==='TimeoutError'?'連線逾時，保留本季上次成功資料':e.message;stale=true;}}
  finally{if(epoch===requestEpoch){busy=false;render();}}
}
async function changeSeason(season){requestEpoch++;busy=false;selectedSeason=season;localStorage.setItem('d77-season',season);data=null;events=[];filter='all';search='';sort='new';error='';await refresh();}
function manageSeasons(){showSeasonSettings({demo,getState:()=>seasonState,api,openDialog,icons,
  saveDemo:({config,makeDefault})=>{seasonState={...seasonState,revision:seasonState.revision+1,defaultSeason:makeDefault||!seasonState.defaultSeason?config.season:seasonState.defaultSeason,seasons:[...seasonState.seasons.filter(s=>s.season!==config.season),{season:config.season,config,testedAt:new Date().toISOString()}]};},
  onSaved:async season=>{if(!demo)seasonState=await api('/seasons');await changeSeason(season);}
});}
function go(target,newFilter='all'){filter=newFilter;search='';sort='new';if(page===target)render();else location.hash=target;}
function openDialog(title,body){$('#detail-title').textContent=title;$('#detail-body').innerHTML=body;icons();if(!$('#detail').open)$('#detail').showModal();}
function orderDetail(id){const o=data.orders.find(o=>o.id===id);if(!o)return;
  openDialog(o.name,`<div class="badges">${badge(o.status,o.status==='已出貨'?'good':'warn')}${badge('總額 '+money(o.total))}${progressBadges(o)}</div><p class="read-only-note">${esc(o.time||'')} ${o.sourceRow?'· 來源列 '+o.sourceRow:''}</p>${o.lines.map(l=>{
    const p=data.products.find(p=>p.name===l.name);return `<div class="detail-line"><strong>${esc(l.name)}</strong><span class="amount">${num(l.quantity)} × ${money(l.price)}</span><div class="badges">${['purchased','shipped','mailed'].map(field=>badge(stageLabel(l,field),l.evidence?.[field]==='conflict'?'bad':l[field]>0?'good':'')).join('')}${badge(p?.rules.length?'已翻譯':'未翻譯',p?.rules.length?'good':'warn')}</div>${links(p)}</div>`;}).join('')}${o.issues?.length?`<p class="notice">${esc(o.issues.join('；'))}</p>`:''}`);
}
function productDetail(name,rulesOnly=false){const p=data.products.find(p=>p.name===name);if(!p)return;
  openDialog(p.name,`${rulesOnly?'':`<div class="finance"><div><small>全新庫存</small><strong>${p.stock}</strong></div><div><small>二手庫存</small><strong>${p.usedStock}</strong></div><div><small>未出貨需求</small><strong>${num(p.outstanding)}</strong></div></div>`}${links(p)}<h3>訂購顧客</h3>${p.customers.map(c=>`<div class="field"><button class="order-name" data-order="${esc(c.id)}">${esc(c.name)}${icon('chevron-right')}</button>${badge(c.mailed===1?'規則已寄':c.mailed===0?'規則未寄':'寄送未確認',c.mailed===1?'good':'')}</div>`).join('')||empty('目前沒有對應的訂購資料')}`);
}
async function markRead(ids){if(!ids.length)return;if(!demo)await api('/read',{ids});events.forEach(e=>{if(ids.includes(e.id))e.read=true;});render();}
async function settings(){
  if(!data&&!token&&!demo){$('#login-status').textContent='請先使用授權的 Google 帳號登入。';return;}
  let value={preferences:{pushEnabled:false,quiet:true,quietStart:22,quietEnd:8,types:['order','change','shortage','rules','activity']},pushAvailable:false};
  if(!demo)try{value=await api('/preferences');}catch(e){setError(e.message);return;}
  const p=value.preferences;
  openDialog('通知與帳號',`<p class="account">${demo?'示範模式':esc(account)}</p><form id="prefs"><label class="field">手機推播<input type="checkbox" name="pushEnabled" ${p.pushEnabled?'checked':''} ${value.pushAvailable?'':'disabled'}></label>${!value.pushAvailable?'<p class="read-only-note">尚未連接手機推播服務，通知中心仍可使用。</p>':''}<label class="field">勿擾時段<input type="checkbox" name="quiet" ${p.quiet?'checked':''}></label><div class="field"><span>開始／結束</span><span><select name="quietStart" aria-label="勿擾開始">${Array.from({length:24},(_,i)=>`<option ${i===p.quietStart?'selected':''} value="${i}">${i}:00</option>`).join('')}</select> — <select name="quietEnd" aria-label="勿擾結束">${Array.from({length:24},(_,i)=>`<option ${i===p.quietEnd?'selected':''} value="${i}">${i}:00</option>`).join('')}</select></span></div>${[['order','新訂單'],['change','訂單異動'],['shortage','缺貨提醒'],['rules','規則完成'],['activity','協作動態']].map(([type,label])=>`<label class="field">${label}<input type="checkbox" name="types" value="${type}" ${p.types.includes(type)?'checked':''}></label>`).join('')}<div class="section-actions"><button class="primary" type="submit">儲存設定</button><button id="logout" type="button">登出</button></div><p id="prefs-status" class="notice" role="status"></p></form>`);
  $('#prefs').onsubmit=async e=>{e.preventDefault();const form=new FormData(e.target);const body={pushEnabled:form.has('pushEnabled'),quiet:form.has('quiet'),quietStart:Number(form.get('quietStart')),quietEnd:Number(form.get('quietEnd')),types:form.getAll('types')};try{if(!demo)await api('/preferences',body);$('#prefs-status').textContent=demo?'示範設定，未寫入雲端':'設定已儲存';}catch(err){$('#prefs-status').textContent=err.message;}};
  $('#logout').onclick=logout;
  const form=$('#prefs');const section=document.createElement('section');section.className='setting-section';section.innerHTML=`<h3>季別與來源</h3><button id="season-manage" type="button" class="setting-link"><span>${icon('calendar-range')}${seasonState.canManage?'管理季別來源':'查看季別'}</span>${icon('chevron-right')}</button>`;form.before(section);$('#season-manage').onclick=manageSeasons;icons();
}
function logout(){requestEpoch++;busy=false;token='';account='';data=null;events=[];demo=false;seasonState={revision:0,defaultSeason:'',seasons:[],canManage:false};clearInterval(timer);$('#detail').close();$('#workspace').hidden=true;$('#nav').hidden=true;$('#login').hidden=false;$('#view').replaceChildren();$('#login-status').textContent='已登出';window.google?.accounts.id.disableAutoSelect();icons();}
const demoButton=$('#demo-enter');
if(demoButton)demoButton.onclick=()=>{demo=true;seasonState=demoSources();selectedSeason='2026秋';data=demoData(selectedSeason);events=seasonEvents(selectedSeason);error='';showWorkspace();};
$('#season-select').onchange=e=>changeSeason(e.target.value);
$('#refresh').onclick=()=>refresh(true);$('#settings').onclick=settings;$('#detail-close').onclick=()=>$('#detail').close();
$('#theme').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('d77-theme',document.documentElement.dataset.theme);};
document.documentElement.dataset.theme=localStorage.getItem('d77-theme')||'light';
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.go)go(b.dataset.go,b.dataset.filter||'all');
  else if(b.dataset.filter){filter=b.dataset.filter;render();}
  else if(b.dataset.order)orderDetail(b.dataset.order);
  else if(b.dataset.product)productDetail(b.dataset.product);
  else if(b.dataset.rule)productDetail(b.dataset.rule,true);
  else if(b.dataset.event){const event=events.find(x=>x.id===b.dataset.event);try{await markRead([event.id]);$('#detail').close();go(event.target.page);if(event.target.id)orderDetail(event.target.id);else if(event.target.name){search=event.target.name;render();}}catch(err){setError(err.message);}}
  else if(b.id==='read-all'){try{await markRead(events.filter(e=>!e.read).map(e=>e.id));}catch(err){setError(err.message);}}
});
window.addEventListener('hashchange',()=>{page=names[location.hash.slice(1)]?location.hash.slice(1):'overview';render();window.scrollTo(0,0);});
$('#nav').addEventListener('click',e=>{if(e.target.closest('a')){filter='all';search='';sort='new';}});
installSwipe($('#workspace'),{current:()=>page,enabled:()=>!!data&&!busy&&!$('#workspace').hidden,navigate:target=>go(target)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&token)refresh();});
async function initializeGoogle(){
  if(!config.googleClientId||!config.apiBase){$('#login-status').textContent='正式雲端連線尚未設定，可先瀏覽示範資料。';icons();return;}
  if(!/^https:\/\//.test(config.apiBase)){ $('#login-status').textContent='API 必須使用 HTTPS';return;}
  for(let n=0;n<40&&!window.google?.accounts?.id;n++)await new Promise(r=>setTimeout(r,250));
  if(!window.google?.accounts?.id){$('#login-status').textContent='Google 登入未載入，請檢查網路後重新整理。';return;}
  window.google.accounts.id.initialize({client_id:config.googleClientId,auto_select:false,callback:async result=>{
    token=result.credential;demo=false;account='Google 授權成員';showWorkspace();await refresh();if(token){timer=setInterval(()=>{if(!document.hidden)refresh();},60000);}
  }});
  window.google.accounts.id.renderButton($('#google-login'),{theme:'outline',size:'large',text:'signin_with',locale:'zh_TW'});icons();
}
initializeGoogle();icons();window.addEventListener('load',icons);

