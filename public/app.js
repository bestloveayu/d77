import {demoSnapshot,demoEvents} from './demo.js';
import {mountRuleCopy,resetRuleCopy} from './rule-copy.js?v=20261109.4';
import {showSeasonSettings} from './season-settings.js';
import {mountWidgetSettings} from './widget-settings.js?v=20261106.1';
import {SOURCE_DEFAULTS} from './season-config.js';
import {stageLabel,orderProgressLabels} from './order-status.js';
import {parseTimestamp} from './timestamp.js?v=20261102.3';
import {installSwipe} from './swipe.js?v=20261102.3';
import {createPushClient} from './push.js?v=20261102.1';
import {classifyFollowUp,awaitingPurchase,notificationChoices,notificationTypes} from './order-followup.js?v=20261103.1';
import {filterTransactions,transactionTotals,transactionAmount,personCash} from './transaction-summary.js?v=20261103.2';
const $=s=>document.querySelector(s),config=window.BOARD_CONFIG||{};
const deviceStorage={get(key){try{return localStorage.getItem(key);}catch{return null;}},set(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}},remove(key){try{localStorage.removeItem(key);}catch{}}};
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n==null?'待核對':'$'+Number(n).toLocaleString('zh-TW');
const num=n=>n==null?'—':n;
const badge=(text,kind='')=>`<span class="badge ${kind}">${esc(text)}</span>`;
const progressBadges=o=>{const task=followUp(o);return orderProgressLabels(o).map(p=>badge(p.text,p.good?'good':'')).join('')+(['registration','rules'].includes(task.kind)?badge(task.label,'warn'):task.kind==='review'?badge(task.reason||task.label,'warn'):'');};
const names={overview:'營運總覽',orders:'顧客訂單',inventory:'庫存查詢',rules:'規則進度',notifications:'最新動態',transactions:'收支紀錄'};
const eventIcon={order:'clipboard-list',change:'git-compare-arrows',shortage:'triangle-alert',rules:'book-open',activity:'package-check',registration:'clipboard-list','rules-pending':'mail'};
const followUp=o=>o.followUp||classifyFollowUp(o);
let data=null,events=[],token='',account='',demo=false,stale=false,busy=false,error='',page='overview',filter='all',search='',sort='new',timer;
let selectedSeason=deviceStorage.get('d77-season')||'',requestEpoch=0,authGeneration=0,composingSearch=false;
let seasonState={revision:0,defaultSeason:'',seasons:[],canManage:false};
let transactionPerson='all',metricNavigationPending=false,dialogSnapshot=null;
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
  page=names[location.hash.slice(1)]?location.hash.slice(1):'overview';
  const widgetFilter=new URLSearchParams(location.search).get('widgetFilter');
  if((page==='orders'&&['pending','registration','rules'].includes(widgetFilter))||(page==='inventory'&&widgetFilter==='shortage'))filter=widgetFilter;
  render();
}
function chrome(){
  $('#page-title').textContent=names[page];
  const select=$('#season-select');select.innerHTML=seasonState.seasons.length?seasonState.seasons.map(s=>`<option value="${esc(s.season)}">${esc(s.season)}</option>`).join(''):'<option value="">未設定季別</option>';select.value=selectedSeason;select.disabled=busy||!seasonState.seasons.length;
  $('#sync-status').textContent=demo?'示範模式 · 未連接雲端':data?`${stale?'資料可能過期':'雲端資料已讀取'} · ${new Date(data.updatedAt).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'尚無成功讀取資料';
  document.querySelectorAll('#nav a').forEach(a=>{a.classList.toggle('active',a.dataset.page===page);a.setAttribute('aria-current',a.dataset.page===page?'page':'false');});
  $('#refresh').disabled=busy;$('#refresh').classList.toggle('spin',busy);setError(error);
}
function heading(title,action){return `<div class="section-heading"><h2>${title}</h2>${action||''}</div>`;}
function financeSummary(action='',className=''){
  const due=data.finance.eastDue,dueText=due==null?'待核對':Math.round(due*100)===0?'已平衡':due<0?'于應給東':'東應給于';
  return `<section class="section ${className}" aria-label="本季收支">${heading(esc(data.season)+' · 本季收支',action)}<div class="finance finance-overview"><div><small>收入</small><strong>${money(data.finance.income)}</strong></div><div><small>成本</small><strong>${money(data.finance.cost)}</strong></div><div><small>結餘</small><strong>${money(data.finance.profit)}</strong></div><div class="season-due"><small>${dueText}</small><strong>${due==null?'待核對':money(Math.abs(due))}</strong></div></div></section>`;
}
function overview(){
  const s=data.summary;
  const registration=data.orders.filter(o=>followUp(o).kind==='registration').length,rulesPending=data.orders.filter(o=>followUp(o).kind==='rules').length,unplaced=data.orders.filter(awaitingPurchase).length;
  const stats=[['clipboard-list','訂單數',s.orders,'','orders','all'],['clock-3','待出貨/待下單',`${registration}/${unplaced}`,registration>0?'warn':'','orders',registration>0?'registration':'pending'],['package-open','缺貨品項',s.shortages,'warn','inventory','shortage'],['book-open-check','規則已完成',`${s.rulesReady}/${s.rulesTotal}`,'','rules','ready']];
  const low=data.products.filter(p=>p.shortage>0||p.usedShortage>0).slice(0,4);
  const finance=financeSummary(`<button class="text-button" data-go="transactions">查看全部 ${icon('chevron-right')}</button>`,'overview-finance');
  return `<section class="section">${heading('最新動態',`<button class="text-button" data-go="notifications">查看全部 ${icon('chevron-right')}</button>`)}${eventList(events.slice(0,3))}</section>
  <section class="section">${heading('待辦提醒')}
    <button class="alert-row warn" data-go="orders" data-filter="registration">${icon('clipboard-list')}<span class="text"><strong>${registration} 筆訂單待出貨登記</strong><small>已下單，尚未完成銷貨收入／出貨登記</small></span>${icon('chevron-right')}</button>
    <button class="alert-row" data-go="orders" data-filter="rules">${icon('mail')}<span class="text"><strong>${rulesPending} 筆訂單待寄規則</strong><small>已完成出貨登記，需要寄送的規則尚未寄齊</small></span>${icon('chevron-right')}</button>
    <button class="alert-row warn" data-go="inventory" data-filter="shortage">${icon('triangle-alert')}<span class="text"><strong>${s.shortages} 款遊戲待補貨</strong><small>依本季金流出貨登記與全新庫存計算</small></span>${icon('chevron-right')}</button>
    <button class="alert-row" data-go="rules" data-filter="ready">${icon('book-open-check')}<span class="text"><strong>${s.rulesReady} 款中文規則已完成</strong><small>查看訂購顧客與規則寄送狀態</small></span>${icon('chevron-right')}</button>
    ${s.unknownStock?`<button class="alert-row warn" data-go="inventory" data-filter="unknown">${icon('circle-help')}<span class="text"><strong>${s.unknownStock} 款出貨證據待確認</strong><small>未將未知狀態當成零或缺貨</small></span>${icon('chevron-right')}</button>`:''}
    ${data.unmatchedShipments?.length?`<button class="alert-row warn" data-go="inventory" data-filter="unknown">${icon('git-compare-arrows')}<span class="text"><strong>${data.unmatchedShipments.length} 筆金流出貨品項待核對</strong><small>尚未對應本季品項，未納入品項出貨量</small></span>${icon('chevron-right')}</button>`:''}
  </section>
  ${finance}
  <section class="section">${heading('缺貨清單',`<button class="text-button" data-go="inventory">查看全部 ${icon('chevron-right')}</button>`)}${stockTable(low)}</section>
  <div class="metrics">${stats.map(([i,label,count,kind,target,targetFilter])=>`<button class="metric ${kind}" data-go="${target}" data-filter="${targetFilter}"><span class="metric-label">${icon(i)}<span>${label}</span></span><span class="metric-value"><strong>${count}</strong><span class="metric-chevron">${icon('chevron-right')}</span></span></button>`).join('')}</div>`;
}
function filters(placeholder,options,sortOptions,className='',extra=''){return `<div class="filters"><label class="search">${icon('search')}<input id="search" type="search" aria-label="${placeholder}" placeholder="${placeholder}" value="${esc(search)}" autocomplete="off"></label>${sortOptions?`<select id="sort" aria-label="排序">${sortOptions.map(([value,label])=>`<option value="${value}" ${sort===value?'selected':''}>${label}</option>`).join('')}</select>`:''}${extra}</div><div class="segments ${className}">${options.map(([value,label])=>`<button data-filter="${value}" class="${filter===value?'active':''}" aria-pressed="${filter===value}">${label}</button>`).join('')}</div>`;}
const parseTime=value=>parseTimestamp(value)??0;
function ordersView(){
  let rows=data.orders.filter(o=>(o.name+' '+(o.nickname||'')+' '+o.lines.map(l=>l.name).join(' ')).toLowerCase().includes(search.toLowerCase()));
  if(filter==='pending')rows=rows.filter(awaitingPurchase);if(filter==='done')rows=rows.filter(o=>o.status==='已出貨');
  if(['registration','rules','review'].includes(filter))rows=rows.filter(o=>followUp(o).kind===filter);
  rows=[...rows].sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh-TW'):(parseTime(a.time)-parseTime(b.time))*(sort==='old'?1:-1));
  return filters('搜尋顧客、品項',[['all','全部'],['registration','待出貨登記'],['rules','待寄規則'],['pending','待下單'],['done','已出貨'],['review','待核對']],[['new','填單時間新到舊'],['old','填單時間舊到新'],['name','依姓名']],'order-followup-filters')+`<div class="count-line"><span>共 ${rows.length} 筆訂單</span><span>依原始訂單分列</span></div>`+
  (rows.map(o=>`<article class="order"><div class="order-top"><div><button class="order-name" data-order="${esc(o.id)}">${esc(o.name||'姓名待核對')}${icon('chevron-right')}</button><p class="order-meta">${esc(o.nickname||'')}${o.nickname?' · ':''}${o.manual?'手動訂單':esc(o.time||'填單時間未記錄')}</p></div><strong>${money(o.total)}</strong></div><div class="badges">${badge(o.status,o.status==='已出貨'?'good':o.status==='待核對'?'bad':'warn')}${progressBadges(o)}${o.manual?badge('手動追加'):''}${o.phoneSuffix?badge('手機末碼 '+o.phoneSuffix):''}</div><div class="order-items">${o.lines.map(l=>`<span class="order-item">${icon('package')}${esc(l.name)} × ${num(l.quantity)}</span>`).join('')}</div></article>`).join('')||empty('沒有符合條件的訂單'));
}
function stockWarnings(p){return `${p.shortage>0?`<small class="shortage-estimate">${p.shortageEstimate?'缺貨估算':'全新缺貨'} ${p.shortage} 盒</small>`:''}${p.usedShortage>0?`<small class="shortage-estimate">二手缺貨 ${p.usedShortage} 盒</small>`:''}`;}
function stockTable(rows,expanded=false){
  if(expanded)return rows.length?`<div class="inventory-scroll" tabindex="0" aria-label="庫存明細"><div class="inventory-stock"><div class="stock-head"><span>品項</span><span>待出貨量</span><span>全新</span><span>二手</span><span></span></div>${rows.map(p=>`<div class="stock-row"><button class="order-name stock-name" data-product="${esc(p.name)}"><span>${esc(p.name)}</span>${stockWarnings(p)}</button><span class="num">${num(p.outstanding)}${p.usedOutstanding!=null&&p.usedOrdered>0?`<small>二手 ${p.usedOutstanding}</small>`:''}</span><span class="num ${p.shortage>0?'deficit':''}">${num(p.stock)}</span><span class="num ${p.usedShortage>0?'deficit':''}">${num(p.usedStock)}</span><button class="icon-button" data-product="${esc(p.name)}" aria-label="查看 ${esc(p.name)}" title="查看品項">${icon('chevron-right')}</button></div>`).join('')}</div></div>`:empty('目前沒有符合條件的品項');
  return rows.length?`<div class="stock-head"><span>品項</span><span>待出</span><span>庫存</span><span>缺貨</span><span></span></div>${rows.map(p=>`<div class="stock-row"><button class="order-name stock-name" data-product="${esc(p.name)}"><span>${esc(p.name)}</span>${stockWarnings(p)}</button><span class="num">${num(p.outstanding)}</span><span class="num">${num(p.stock)}</span><span class="num ${p.shortage>0||p.usedShortage>0?'deficit':''}">${num(p.shortage)}${p.usedShortage>0?`<small>二手 ${p.usedShortage}</small>`:''}</span><button class="icon-button" data-product="${esc(p.name)}" aria-label="查看 ${esc(p.name)}" title="查看品項">${icon('chevron-right')}</button></div>`).join('')}`:empty('目前沒有符合條件的品項');
}
function inventoryView(){
  let rows=data.products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
  if(filter==='shortage')rows=rows.filter(p=>p.shortage>0||p.usedShortage>0);if(filter==='used')rows=rows.filter(p=>p.usedStock!==0||p.usedOrdered>0||p.usedShipped>0);if(filter==='unknown')rows=rows.filter(p=>p.coverage==='unknown');
  const totalStock=p=>(p.stock??0)+(p.usedStock??0);
  rows=[...rows].sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh-TW'):sort==='outstanding-desc'?(b.outstanding??-1)-(a.outstanding??-1):sort==='ordered-desc'?(b.ordered??-1)-(a.ordered??-1):sort==='stock-desc'?totalStock(b)-totalStock(a):sort==='stock'?totalStock(a)-totalStock(b):sort==='shortage'?(b.shortage??-1)-(a.shortage??-1):(b.stockUpdatedTime||0)-(a.stockUpdatedTime||0)||(b.stockUpdatedRow||0)-(a.stockUpdatedRow||0));
  const reconcile=data.unmatchedShipments?.length?`<button id="inventory-reconcile" class="alert-row warn">${icon('triangle-alert')}<span class="text"><strong>${data.unmatchedShipments.length} 筆金流出貨未對應本季品項</strong><small>這些出貨尚未納入下列數量</small></span>${icon('chevron-right')}</button>`:'';
  return filters('搜尋品項',[['all','全部'],['shortage','缺貨'],['used','二手'],['unknown','待確認']],[['new','更新時間新到舊'],['shortage','缺貨多到少'],['outstanding-desc','待出貨量由多至少'],['ordered-desc','訂購量由多至少'],['stock-desc','庫存由多至少'],['name','依名稱'],['stock','庫存少到多']])+reconcile+stockTable(rows,true)+`<p class="read-only-note">${icon('info')} 待出量＝訂購量－本季金流出貨量；缺貨＝待出量－全新庫存，最低為 0。二手獨立計算，不與全新互抵。</p>`;
}
function rulesView(){
  let rows=data.products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
  if(filter==='ready')rows=rows.filter(p=>p.rules.length);if(filter==='pending')rows=rows.filter(p=>!p.rules.length);
  rows=[...rows].sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'zh-TW'):(b.ordered||0)-(a.ordered||0));
  return filters('搜尋遊戲',[['all','全部'],['pending','待備齊'],['ready','已完成']],[['new','訂購量多到少'],['name','依名稱']])+`<div class="info-band">${icon('book-open-check')} 已備齊 ${data.summary.rulesReady} / ${data.summary.rulesTotal} 款</div>`+
  (rows.map(p=>`<article class="rule-row"><div class="rule-art">${icon(p.rules.length?'book-open-check':'book-open')}</div><div class="rule-main"><h3>${esc(p.name)}</h3>${badge(p.rules.length?'已完成':'尚無中文規則',p.rules.length?'good':'warn')}${links(p)}<p class="rule-meta">訂購 ${num(p.ordered)} 盒 · 對應 ${p.customers.length} 筆訂單</p></div><button class="icon-button" data-rule="${esc(p.name)}" title="查看訂購" aria-label="查看 ${esc(p.name)} 訂購顧客">${icon('chevron-right')}</button></article>`).join('')||empty('沒有符合條件的規則'));
}
function eventList(rows){return rows.length?rows.map(e=>`<article class="event ${e.read?'':'unread'}"><span class="event-icon">${icon(eventIcon[e.type]||'bell')}</span><div class="event-main"><button data-event="${esc(e.id)}">${esc(e.title)}</button><p>${esc(e.detail)}</p><p>${new Date(e.time).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</p></div></article>`).join(''):empty('目前沒有新通知');}
function notificationsView(){return `<button class="text-button" data-go="overview">${icon('arrow-left')}返回營運總覽</button><div class="section-heading"><span class="muted">最近 150 則動態</span><button id="read-all" class="text-button">${icon('check-check')}全部已讀</button></div><div class="segments"><button data-filter="all" class="${filter==='all'?'active':''}">全部</button><button data-filter="unread" class="${filter==='unread'?'active':''}">未讀</button></div>${eventList(events.filter(e=>filter!=='unread'||!e.read))}`;}
function transactionsView(){
  let rows=filterTransactions(data.transactions||[],{search,type:filter,person:transactionPerson});
  rows=[...rows].sort((a,b)=>(parseTime(a.time)-parseTime(b.time)||a.sourceRow-b.sourceRow)*(sort==='old'?1:-1));
  const totals=transactionTotals(rows,transactionPerson),personLabel={all:'全部收付款人',east:'小東',yu:'于正'}[transactionPerson];
  const personSelect=`<select id="transaction-person" aria-label="收付款人">${[['all','全部收付款人'],['east','小東'],['yu','于正']].map(([value,label])=>`<option value="${value}" ${transactionPerson===value?'selected':''}>${label}</option>`).join('')}</select>`;
  const subtotal=`<section class="transaction-subtotal" aria-label="篩選小計"><h3>篩選小計 · ${totals.count} 筆 · ${personLabel}</h3><div class="transaction-subtotal-values"><div><small>收入</small><strong>${money(totals.income)}</strong></div><div><small>成本</small><strong>${money(totals.cost)}</strong></div><div><small>結餘</small><strong>${money(totals.profit)}</strong></div></div>${totals.profit==null?'<p class="notice">部分金額尚無可核對資料，小計未當成零。</p>':''}</section>`;
  return financeSummary()+filters('搜尋品項、顧客、名目或交易編號',[['all','全部'],...['進貨成本','銷貨收入','其他成本','其他收入','結算','未分類'].map(x=>[x,x])],[['new','時間新到舊'],['old','時間舊到新']],'transaction-filters',personSelect)+subtotal+`<p class="count-line">${esc(data.season)} · 共 ${rows.length} 筆明細</p>`+(rows.length?transactionList(rows,transactionPerson):empty(data.transactions?'沒有符合條件的交易':'尚未取得交易明細，請重新讀取雲端'));
}
function transactionList(rows,person='all'){return rows.map(t=>`<article class="order"><div class="order-top"><div><button class="order-name" data-transaction="${esc(t.id)}" data-person="${person}">${esc(t.subject||t.name||'—')}${icon('chevron-right')}</button><p class="order-meta">${esc(t.time||'時間未記錄')} · ${esc(t.actor||'收付款人未記錄')}</p></div><strong>${money(transactionAmount(t,person))}</strong></div><div class="badges">${badge(t.kind,['銷貨收入','其他收入'].includes(t.kind)?'good':['進貨成本','其他成本'].includes(t.kind)?'warn':'')}${t.name?badge(t.name):''}${t.quantity?badge('數量 '+t.quantity):''}</div></article>`).join('');}
function transactionDetail(id,person='all',snapshot=data){
  const t=snapshot?.transactions?.find(t=>t.id===id);if(!t)return;
  const own=personCash(t,person),selected=['east','yu'].includes(person)?`<h3>${person==='east'?'小東':'于正'}收付款</h3><p>收入 ${money(own.income)} · 成本 ${money(own.cost)}</p><h3>完整交易</h3>`:'';
  openDialog('交易明細',`${selected}<div class="badges">${badge(t.kind)}</div><h3>${esc(t.subject||t.name||'—')}</h3><p>${esc(t.time||'時間未記錄')} · ${esc(t.actor||'收付款人未記錄')}</p><p>品項：${esc(t.name||'—')}　數量：${num(t.quantity)}</p>${t.kind==='結算'?`<p>交易金額：${money(t.amount)}</p>`:''}<div class="finance"><div><small>收入</small><strong>${money(t.income)}</strong></div><div><small>成本</small><strong>${money(t.cost)}</strong></div></div><p class="transaction-note">${esc(t.note||'無備註')}</p><p class="transaction-id">交易編號：${esc(t.transactionId||'未記錄')}<br>來源列：${t.sourceRow}</p>`,snapshot);
}
function render(){
  if(composingSearch&&document.activeElement?.id==='search'){chrome();return;}
  $('#nav .order-export-dock')?.remove();
  resetRuleCopy(page==='rules'?data?.season:'');
  if(!data){$('#view').innerHTML=empty('尚無成功讀取資料，請檢查雲端連線設定');chrome();icons();return;}
  $('#view').innerHTML=({overview,orders:ordersView,inventory:inventoryView,rules:rulesView,notifications:notificationsView,transactions:transactionsView}[page])();
  if(page==='orders'){
    const root=$('#view'),orders=new Map(data.orders.map(o=>[String(o.id),o])),entries=[];
    for(const article of root.querySelectorAll('.order')){
      const o=orders.get(article.querySelector('[data-order]')?.dataset.order);
      if(o?.lines?.length)entries.push({article,area:article,order:{name:o.name,total:o.total,lines:o.lines.map(l=>({name:l.name,quantity:l.quantity,price:l.price}))}});
    }
    globalThis.D77OrderImage.mount(root,entries,{season:data.season,share:true,dock:$('#nav')});
  }
  if(page==='rules')mountRuleCopy($('#view'),$('#nav'),data.products,openDialog,esc);
  chrome();icons();
  const field=$('#search');
  const applySearch=(input,force=false)=>{
    if(!force&&input.value===search)return;
    const cursor=input.selectionStart,position=window.scrollY;search=input.value;render();
    const next=$('#search');next?.focus();try{next?.setSelectionRange(cursor,cursor);}catch{}window.scrollTo(0,position);
  };
  field?.addEventListener('compositionstart',()=>{composingSearch=true;});
  field?.addEventListener('compositionend',e=>{composingSearch=false;applySearch(e.target,true);});
  field?.addEventListener('blur',()=>{composingSearch=false;});
  field?.addEventListener('input',e=>{if(!composingSearch&&!e.isComposing)applySearch(e.target);});
  $('#sort')?.addEventListener('change',e=>{sort=e.target.value;render();});
  $('#transaction-person')?.addEventListener('change',e=>{transactionPerson=e.target.value;render();});
}
async function api(path,body,authToken=token){
  if(!config.apiBase||!authToken)throw new Error('請先完成登入與雲端設定');
  const endpoint=new URL(config.apiBase.replace(/\/$/,'')+path);if(selectedSeason&&!path.startsWith('/seasons')&&path!=='/preferences')endpoint.searchParams.set('season',selectedSeason);
  const response=await fetch(endpoint,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+authToken,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:AbortSignal.timeout(60000)});
  const result=await response.json();if(!response.ok){if(response.status===401||result.code==='AUTH_FORBIDDEN'){if(authToken===token)logout(false);throw new Error(result.code==='AUTH_FORBIDDEN'?'此帳號已無存取權限':'登入已過期，請重新登入');}throw new Error(result.error||'讀取失敗');}return result;
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
async function changeSeason(season){requestEpoch++;busy=false;selectedSeason=season;deviceStorage.set('d77-season',season);data=null;events=[];filter='all';search='';sort='new';transactionPerson='all';error='';$('#detail').close();await refresh();}
function manageSeasons(){showSeasonSettings({demo,getState:()=>seasonState,api,openDialog,icons,
  saveDemo:({config,makeDefault})=>{seasonState={...seasonState,revision:seasonState.revision+1,defaultSeason:makeDefault||!seasonState.defaultSeason?config.season:seasonState.defaultSeason,seasons:[...seasonState.seasons.filter(s=>s.season!==config.season),{season:config.season,config,testedAt:new Date().toISOString()}]};},
  onSaved:async season=>{if(!demo)seasonState=await api('/seasons');await changeSeason(season);}
});}
function go(target,newFilter='all'){filter=newFilter;search='';sort='new';transactionPerson='all';if(page===target)render();else location.hash=target;}
function openDialog(title,body,snapshot=data){dialogSnapshot=snapshot;$('#detail-title').textContent=title;$('#detail-body').innerHTML=body;icons();if(!$('#detail').open)$('#detail').showModal();}
function orderDetail(id){const o=data.orders.find(o=>o.id===id);if(!o)return;
  openDialog(o.name,`<div class="badges">${badge(o.status,o.status==='已出貨'?'good':'warn')}${badge('總額 '+money(o.total))}${progressBadges(o)}</div><p class="read-only-note">${esc(o.time||'')} ${o.sourceRow?'· 來源列 '+o.sourceRow:''}</p>${o.lines.map(l=>{
    const p=data.products.find(p=>p.name===l.name);return `<div class="detail-line"><strong>${esc(l.name)}</strong><span class="amount">${num(l.quantity)} × ${money(l.price)}</span><div class="badges">${['purchased','shipped','mailed'].map(field=>badge(stageLabel(l,field),l.evidence?.[field]==='conflict'?'bad':l[field]>0?'good':'')).join('')}${badge(p?.rules.length?'已翻譯':'未翻譯',p?.rules.length?'good':'warn')}</div>${links(p)}</div>`;}).join('')}${o.issues?.length?`<p class="notice">${esc(o.issues.join('；'))}</p>`:''}`);
}
function productDetail(name,rulesOnly=false){const p=data.products.find(p=>p.name===name);if(!p)return;
  const cells=[['訂購量',p.ordered],['已確認出貨（金流）',p.shipped],['待出',p.outstanding],['缺貨',p.shortage],['全新庫存',p.stock],['二手庫存',p.usedStock],['二手已出貨（金流）',p.usedShipped]];
  if(p.usedOrdered!=null)cells.push(['二手訂購量',p.usedOrdered],['二手待出',p.usedOutstanding],['二手缺貨',p.usedShortage]);
  const inventory=`<div class="finance inventory-detail">${cells.map(([label,value])=>`<div><small>${label}</small><strong>${value==null?'待核對':['已確認出貨（金流）','二手已出貨（金流）'].includes(label)?`<button class="shipment-value" data-shipment-product="${esc(p.name)}" data-condition="${label.startsWith('二手')?'used':'new'}" title="查看採用的金流明細">${num(value)}</button>`:num(value)}</strong></div>`).join('')}</div>${data.unmatchedShipments?.length?`<p class="notice">尚有 ${data.unmatchedShipments.length} 筆未對應出貨未納入計算，請先至庫存查詢核對。</p>`:''}${p.shortage!=null?`<p class="read-only-note">全新缺貨：max(0, ${num(p.ordered)} − ${num(p.shipped)} − ${num(p.stock)}) ＝ ${p.shortage}</p>`:''}${p.stockUpdatedAt?`<p class="read-only-note">最近庫存異動：${esc(p.stockUpdatedAt)}</p>`:''}${p.usedOrdered==null?'<p class="read-only-note">二手訂購量未提供，未推算二手待出與缺貨。</p>':''}${p.coverage==='unknown'?'<p class="notice">部分訂購量、庫存或金流出貨資料待核對，對應的缺貨量未推算。</p>':''}`;
  openDialog(p.name,`${rulesOnly?'':inventory}${links(p)}<h3>訂購顧客</h3>${p.customers.map(c=>`<div class="field"><button class="order-name" data-order="${esc(c.id)}">${esc(c.name)}${icon('chevron-right')}</button>${badge(c.mailed===1?'規則已寄':c.mailed===0?'規則未寄':'寄送未確認',c.mailed===1?'good':'')}</div>`).join('')||empty('目前沒有對應的訂購資料')}`);
}
function shipmentDetail(name,condition='new',snapshot=data){
  const p=snapshot?.products.find(p=>p.name===name);if(!p)return;
  const used=condition==='used',ids=used?p.usedShipmentTransactionIds:p.shipmentTransactionIds,expected=used?p.usedShipped:p.shipped;
  if(!Array.isArray(ids)){openDialog('出貨金流明細',empty('尚未取得出貨明細，請重新讀取雲端'));return;}
  const wanted=new Set(ids),rows=(snapshot.transactions||[]).filter(t=>wanted.has(t.id)).sort((a,b)=>parseTime(b.time)-parseTime(a.time)||b.sourceRow-a.sourceRow);
  const quantity=rows.every(t=>Number.isInteger(t.quantity))?rows.reduce((sum,t)=>sum-t.quantity,0):null,consistent=rows.length===wanted.size&&quantity===expected;
  openDialog(`${p.name} · ${used?'二手':'全新'}出貨金流`,`${consistent?`<p class="info-band">${rows.length} 筆金流 · 淨出貨 ${num(expected)} 盒</p>`:'<p class="notice">出貨量與明細尚未完整核對，請重新讀取資料。</p>'}${rows.length?transactionList(rows):empty('本季沒有納入計算的出貨紀錄')}`,snapshot);
}
async function markRead(ids){if(!ids.length)return;if(!demo)await api('/read',{ids});events.forEach(e=>{if(ids.includes(e.id))e.read=true;});render();}
async function settings(){
  const settingsGeneration=authGeneration,settingsToken=token;
  const sameSession=()=>authGeneration===settingsGeneration&&token===settingsToken;
  const settingsApi=(path,body)=>{if(!sameSession())throw Error('登入狀態已變更');return api(path,body,settingsToken);};
  const devicePush=createPushClient((path,body)=>api(path,body,settingsToken),globalThis,{isCurrent:sameSession});
  if(!data&&!token&&!demo){$('#login-status').textContent='請先使用授權的 Google 帳號登入。';return;}
  let value={preferences:{pushEnabled:false,quiet:true,quietStart:22,quietEnd:8,types:notificationTypes},pushAvailable:false};
  if(!demo)try{value=await settingsApi('/preferences');}catch(e){setError(e.message);return;}
  if(!sameSession())return;
  const p=value.preferences;
  openDialog('通知與帳號',`<p class="account">${demo?'示範模式':esc(account)}</p><form id="prefs"><label class="field">手機推播<input type="checkbox" name="pushEnabled" ${p.pushEnabled?'checked':''} ${value.pushAvailable?'':'disabled'}></label>${!value.pushAvailable?'<p class="read-only-note">尚未連接手機推播服務，通知中心仍可使用。</p>':''}<label class="field">勿擾時段<input type="checkbox" name="quiet" ${p.quiet?'checked':''}></label><div class="field"><span>開始／結束</span><span><select name="quietStart" aria-label="勿擾開始">${Array.from({length:24},(_,i)=>`<option ${i===p.quietStart?'selected':''} value="${i}">${i}:00</option>`).join('')}</select> — <select name="quietEnd" aria-label="勿擾結束">${Array.from({length:24},(_,i)=>`<option ${i===p.quietEnd?'selected':''} value="${i}">${i}:00</option>`).join('')}</select></span></div>${[['order','新訂單'],['change','訂單異動'],['shortage','缺貨提醒'],['rules','規則完成'],['activity','協作動態']].map(([type,label])=>`<label class="field">${label}<input type="checkbox" name="types" value="${type}" ${p.types.includes(type)?'checked':''}></label>`).join('')}<div class="section-actions"><button class="primary" type="submit">儲存設定</button><button id="logout" type="button">登出</button></div><p id="prefs-status" class="notice" role="status"></p></form>`);
  for(const [type,label] of notificationChoices){
    if($('#prefs').querySelector(`input[name=types][value="${type}"]`))continue;
    const row=document.createElement('label');row.className='field';row.append(document.createTextNode(label));
    const input=document.createElement('input');input.type='checkbox';input.name='types';input.value=type;input.checked=p.types.includes(type);row.append(input);
    $('#prefs .section-actions').before(row);
  }
  $('#prefs').onsubmit=async e=>{e.preventDefault();const form=new FormData(e.target);const body={pushEnabled:form.has('pushEnabled'),quiet:form.has('quiet'),quietStart:Number(form.get('quietStart')),quietEnd:Number(form.get('quietEnd')),types:form.getAll('types')};try{if(!demo)await api('/preferences',body);$('#prefs-status').textContent=demo?'示範設定，未寫入雲端':'設定已儲存';}catch(err){$('#prefs-status').textContent=err.message;}};
  $('#logout').onclick=logout;
  mountWidgetSettings({form:$('#prefs'),api:settingsApi,isCurrent:sameSession,demo});
  const pushSection=document.createElement('section');pushSection.className='setting-section push-settings';
  pushSection.innerHTML=`<h3>此裝置通知</h3><p id="push-status" role="status">正在讀取裝置狀態…</p><div class="section-actions"><button id="push-enable" type="button">${icon('bell-ring')}啟用通知</button><button id="push-test" type="button">${icon('send')}測試通知</button><button id="push-disable" type="button">${icon('bell-off')}停用此裝置</button></div>`;
  $('#prefs').before(pushSection);
  let pushBusy=false;
  const pushButtons=()=>pushSection.querySelectorAll('button');
  const showPushState=async()=>{
    const state=demo?{available:false,supported:devicePush.supported(),subscribed:false}:await devicePush.status();
    if(!sameSession())return;
    pushSection.querySelector('#push-status').textContent=!state.supported?'此瀏覽器不支援通知':!state.available?(state.health?.message||'推播服務尚未就緒'):state.subscribed?'此裝置已啟用通知':state.permission==='denied'?'通知權限已封鎖，請至瀏覽器網站設定調整':'此裝置尚未啟用通知';
    pushSection.querySelector('#push-enable').disabled=!state.supported||!state.available||state.subscribed;
    pushSection.querySelector('#push-test').disabled=!state.subscribed;
    // Allow cleanup of a browser subscription left by another signed-in account.
    pushSection.querySelector('#push-disable').disabled=!state.supported||!state.available;
  };
  const pushAction=async(action)=>{
    if(pushBusy)return;pushBusy=true;pushButtons().forEach(b=>b.disabled=true);
    const status=pushSection.querySelector('#push-status');status.textContent='處理中…';
    try{
      if(action==='enable'){
        await devicePush.enable();if(!sameSession())return;
        const checkbox=$('#prefs [name=pushEnabled]');checkbox.checked=true;
        const form=new FormData($('#prefs'));
        await settingsApi('/preferences',{pushEnabled:true,quiet:form.has('quiet'),quietStart:Number(form.get('quietStart')),quietEnd:Number(form.get('quietEnd')),types:form.getAll('types')});
      }else if(action==='test')await devicePush.test();else await devicePush.disable();
      await showPushState();if(action==='test')status.textContent='測試已交給推播服務，請查看手機通知';
    }catch(e){try{await showPushState();}catch{}status.textContent=e.message;}
    finally{pushBusy=false;}
  };
  pushSection.querySelector('#push-enable').onclick=()=>pushAction('enable');
  pushSection.querySelector('#push-test').onclick=()=>pushAction('test');
  pushSection.querySelector('#push-disable').onclick=()=>pushAction('disable');
  pushButtons().forEach(b=>b.disabled=true);showPushState().catch(e=>{pushSection.querySelector('#push-status').textContent=e.message;});
  const form=$('#prefs');const section=document.createElement('section');section.className='setting-section';section.innerHTML=`<h3>季別與來源</h3><button id="season-manage" type="button" class="setting-link"><span>${icon('calendar-range')}${seasonState.canManage?'管理季別來源':'查看季別'}</span>${icon('chevron-right')}</button>`;form.before(section);$('#season-manage').onclick=manageSeasons;icons();
}
async function logout(cleanup=true){
  const oldToken=token,remove=cleanup!==false&&!demo&&!!token;authGeneration++;
  dialogSnapshot=null;transactionPerson='all';metricNavigationPending=false;
  deviceStorage.remove('d77-session');
  requestEpoch++;busy=false;token='';account='';data=null;events=[];demo=false;seasonState={revision:0,defaultSeason:'',seasons:[],canManage:false};clearInterval(timer);$('#detail').close();$('#workspace').hidden=true;$('#nav').hidden=true;$('#login').hidden=false;$('#view').replaceChildren();$('#login-status').textContent='已登出';window.google?.accounts.id.disableAutoSelect();icons();
  if(remove){
    try{await createPushClient((path,body)=>api(path,body,oldToken)).disable();}catch{/* Browser unsubscribe still runs if the API is unavailable. */}
    finally{if(oldToken.startsWith('d77s_'))try{await api('/session/logout',{},oldToken);}catch{$('#login-status').textContent='本機已登出；雲端撤銷未確認，請連線後再次登入並登出。';}}
  }
}
const demoButton=$('#demo-enter');
if(demoButton)demoButton.onclick=()=>{demo=true;seasonState=demoSources();selectedSeason='2026秋';data=demoData(selectedSeason);events=seasonEvents(selectedSeason);error='';showWorkspace();};
$('#season-select').onchange=e=>changeSeason(e.target.value);
$('#refresh').onclick=()=>refresh(true);$('#settings').onclick=settings;$('#detail-close').onclick=()=>$('#detail').close();
$('#theme').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';deviceStorage.set('d77-theme',document.documentElement.dataset.theme);};
document.documentElement.dataset.theme=deviceStorage.get('d77-theme')||'light';
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.go){
    if(b.classList.contains('metric')){
      if(metricNavigationPending)return;metricNavigationPending=true;const generation=authGeneration,originPage=page;
      try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await b.animate([{transform:'scale(.98)'},{transform:'scale(1)'}],{duration:120,easing:'ease-out'}).finished;}
      catch{}finally{metricNavigationPending=false;}
      if(generation!==authGeneration||page!==originPage)return;
    }
    go(b.dataset.go,b.dataset.filter||'all');
  }
  else if(b.dataset.filter){filter=b.dataset.filter;render();}
  else if(b.dataset.order)orderDetail(b.dataset.order);
  else if(b.dataset.transaction)transactionDetail(b.dataset.transaction,b.dataset.person||'all',b.closest('#detail-body')?dialogSnapshot:data);
  else if(b.dataset.shipmentProduct)shipmentDetail(b.dataset.shipmentProduct,b.dataset.condition,dialogSnapshot||data);
  else if(b.id==='inventory-reconcile')openDialog('金流出貨品項待核對',(data.unmatchedShipments||[]).map(t=>`<div class="detail-line"><strong>${esc(t.name||'品項空白')}</strong><p>${t.used?'二手':'全新'} · 增減數量 ${num(t.quantity)} · 金流來源列 ${esc(t.sourceRow)}</p><p class="notice">${esc(({ambiguous:'品項名稱對應到多個品項，未納入出貨量',unmatched:'找不到對應本季品項，未納入出貨量'})[t.reason]||t.reason||'找不到唯一對應本季品項，未納入品項出貨量')}</p></div>`).join(''));
  else if(b.dataset.product)productDetail(b.dataset.product);
  else if(b.dataset.rule)productDetail(b.dataset.rule,true);
  else if(b.dataset.event){const event=events.find(x=>x.id===b.dataset.event);try{await markRead([event.id]);$('#detail').close();go(event.target.page);if(event.target.id)orderDetail(event.target.id);else if(event.target.name){search=event.target.name;render();}}catch(err){setError(err.message);}}
  else if(b.id==='read-all'){try{await markRead(events.filter(e=>!e.read).map(e=>e.id));}catch(err){setError(err.message);}}
});
window.addEventListener('hashchange',()=>{page=names[location.hash.slice(1)]?location.hash.slice(1):'overview';render();window.scrollTo(0,0);});
$('#nav').addEventListener('click',e=>{const link=e.target.closest('a');if(link){filter='all';search='';sort='new';transactionPerson='all';if(link.dataset.page===page)render();}});
installSwipe($('#workspace'),{current:()=>page,enabled:()=>page!=='notifications'&&!!data&&!busy&&!$('#workspace').hidden,navigate:target=>go(target),decorate:icons,preview:target=>{
  const previous={filter,search,sort,transactionPerson};filter='all';search='';sort='new';transactionPerson='all';
  try{return ({overview,orders:ordersView,inventory:inventoryView,rules:rulesView,transactions:transactionsView}[target])();}
  finally{({filter,search,sort,transactionPerson}=previous);}
}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&token)refresh();});
async function initializeGoogle(){
  if(!config.googleClientId||!config.apiBase){$('#login-status').textContent='正式雲端連線尚未設定，可先瀏覽示範資料。';icons();return;}
  if(!/^https:\/\//.test(config.apiBase)){ $('#login-status').textContent='API 必須使用 HTTPS';return;}
  await restoreSession();
  for(let n=0;n<40&&!window.google?.accounts?.id;n++)await new Promise(r=>setTimeout(r,250));
  if(!window.google?.accounts?.id){$('#login-status').textContent='Google 登入未載入，請檢查網路後重新整理。';return;}
  window.google.accounts.id.initialize({client_id:config.googleClientId,auto_select:false,callback:async result=>{
    const generation=++authGeneration;token=result.credential;demo=false;account='Google 授權成員';deviceStorage.remove('d77-session');let persistenceWarning='';
    if($('#remember-login').checked){
      try{const session=await api('/session',{});if(generation!==authGeneration)return;token=session.token;account=session.viewer;if(!deviceStorage.set('d77-session',JSON.stringify({token:session.token,expiresAt:session.expiresAt})))persistenceWarning='瀏覽器不允許保存登入；目前僅在此頁面登入。';}
      catch(e){if(generation!==authGeneration)return;token='';$('#login-status').textContent='無法保存登入：'+e.message;return;}
    }
    showWorkspace();await refresh();if(persistenceWarning)setError(persistenceWarning);if(token){clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)refresh();},60000);}
  }});
  window.google.accounts.id.renderButton($('#google-login'),{theme:'outline',size:'large',text:'signin_with',locale:'zh_TW'});icons();
}
async function restoreSession(){
  let saved;try{saved=JSON.parse(deviceStorage.get('d77-session')||'null');}catch{deviceStorage.remove('d77-session');return;}
  if(!saved)return;
  if(!/^d77s_[a-f0-9]{64}$/.test(saved.token)||!Number.isFinite(saved.expiresAt)||saved.expiresAt<=Date.now()){deviceStorage.remove('d77-session');return;}
  const generation=++authGeneration;token=saved.token;$('#login-status').textContent='正在恢復登入…';
  try{const session=await api('/session');if(generation!==authGeneration)return;account=session.viewer;showWorkspace();await refresh();if(token){clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)refresh();},60000);}}
  catch(e){if(generation===authGeneration){token='';$('#login-status').textContent='無法恢復登入：'+e.message;}}
}
initializeGoogle();icons();window.addEventListener('load',icons);
