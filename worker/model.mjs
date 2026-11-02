import {classifyFollowUp,needsAttention} from '../public/order-followup.js';
import {parseTimestamp as stockTime} from '../public/timestamp.js';
export const norm = v => String(v ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
function exemption(value){
  const text=norm(value);if(['true','1','是','不需寄送','不需寄送中文規則'].includes(text))return true;
  if(['false','0','否','需要寄送','需寄送'].includes(text))return false;
  return null;
}
export async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, '0')).join('');
}
const n = v => {
  if (v === '' || v == null) return null;
  const value = Number(String(v).replace(/[,$\s元NT¥￥]/g, ''));
  return Number.isFinite(value) ? value : null;
};
function table(rows, required) {
  const h = rows.slice(0, 10).findIndex(r => required.every(name => r.some(v => norm(v) === norm(name))));
  if (h < 0) throw new Error('找不到必要欄位：' + required.join('、'));
  const headers = rows[h].map(norm);
  const used = headers.filter(Boolean);
  if (new Set(used).size !== used.length) throw new Error('欄位名稱重複，未採用資料');
  return rows.slice(h + 1).map((r, i) => ({ row: h + i + 2, raw: key => r[headers.indexOf(norm(key))], get: key => r[headers.indexOf(norm(key))] ?? '' }));
}
export function decodeTeam(rows) {
  const m = /^collaboration-v1:(\d+)$/.exec(String(rows[0]?.[0]));
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 128) throw new Error('協作快照標頭無效');
  let value = '';
  for (let i = 1; i <= Number(m[1]); i++) {
    if (typeof rows[i]?.[0] !== 'string' || !rows[i][0].startsWith('J')) throw new Error('協作快照不完整');
    value += rows[i][0].slice(1);
  }
  const state = JSON.parse(value);
  if (!state || typeof state !== 'object') throw new Error('協作資料格式不正確');
  return state;
}
export function catalog(rows) {
  return table(rows, ['中文名稱']).filter(r => r.get('中文名稱')).map(r => ({
    name: String(r.get('中文名稱')).trim(), foreignName: String(r.get('外文名稱')).trim(),
    price: n(r.get('代購(台)')), ordered: n(r.get('訂購量')), reserved: n(r.get('預約量')),
    usedOrdered: (()=>{const q=n(r.get('二手訂購量'));return Number.isInteger(q)&&q>=0?q:null;})(),
    booth: String(r.get('攤位')), ruleUrl: safeUrl(r.get('規則書')), noRulesRequired:exemption(r.get('不需寄送中文規則')), row: r.row
  }));
}
export function safeUrl(value) {
  try { const u = new URL(String(value)); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; }
}
export function resolver(items, aliases = {}) {
  return value => {
    const aliased = aliases[String(value)] ?? value;
    const matches = items.filter(i => [i.name, i.foreignName].filter(Boolean).some(k => norm(k) === norm(aliased)));
    return matches.length === 1 ? matches[0] : null;
  };
}
function quantity(value) {
  const s = String(value ?? '').normalize('NFKC').trim();
  if (['', '0', '不購買', '不買', '無', '否'].includes(s)) return 0;
  if (!/^\d+(?:\.0+)?\s*(?:份|盒|套|個|件)?$/.test(s)) return null;
  const valueN = Number.parseInt(s, 10);
  return valueN <= 999 ? valueN : null;
}
function headerProduct(header) {
  const bracket = [...String(header).matchAll(/\[([^\]]+)\]/g)].at(-1)?.[1];
  const prompt = bracket && /^(?:請勾選數量|row\s*1)$/i.test(bracket.trim());
  const source = bracket && !prompt ? bracket : String(header).replace(/\s*\[[^\]]+\]\s*$/, '');
  const title = source.match(/【([^】]+)】/)?.[1];
  const price = source.match(/(?:[:：]|NT\$|\$)\s*([\d,]+(?:\.\d+)?)/) || source.match(/([\d,]+(?:\.\d+)?)\s*元/);
  if (!bracket && !price && !source.includes('【')) return null;
  const name = (title || source.split(/\s+\d+\s*[-–~〜～]\s*\d+\s*人|\s+\d+\s*人|[:：]/)[0].trim()).replace(/^[A-ZＡ-Ｚ][.．、]\s*/, '').replace(/^(?:新作|前作)\s*[-－]\s*/, '');
  return { name, price: price ? n(price[1]) : null };
}
export async function parseResponses(rows, config, items) {
  const h = rows.slice(0, 10).findIndex(r => r.some(v => ['姓名','真實姓名','客戶姓名','收件人姓名'].includes(norm(v))));
  if (h < 0) throw new Error('預購回應找不到姓名欄');
  const headers = rows[h].map(String), normalized = headers.map(norm);
  const find = aliases => { const found = normalized.flatMap((v,i) => aliases.map(norm).includes(v) ? [i] : []); if (found.length > 1) throw new Error('聯絡資料欄位不唯一'); return found[0] ?? -1; };
  const nameCol = find(['姓名','真實姓名','客戶姓名','收件人姓名']);
  const emailCol = find(['電子郵件地址','電子郵件','email']);
  const phoneCol = find(['手機號碼','手機','電話','聯絡電話']);
  const nicknameCol = find(['FB暱稱','Facebook暱稱']);
  const timeCol = find(['時間戳記','時間戳','timestamp','提交時間']);
  const wishCol = normalized.findIndex(x => x.startsWith('許願區'));
  const storeCol = headers.findIndex(x => /取貨.*(?:店|門市)|門市名稱/.test(x));
  const ignored = new Set([nameCol,emailCol,phoneCol,nicknameCol,timeCol,wishCol,storeCol]);
  const resolve = resolver(items, config.aliases), sourceResolve=resolver(items);
  const columns = headers.flatMap((v,i) => {
    if (ignored.has(i)) return [];
    const override = config.productColumns?.[String(i)];
    const parsed = override === false ? null : override || headerProduct(v);
    return parsed ? [{ col: i, ...parsed }] : [];
  });
  if (!columns.length) throw new Error('沒有可辨識商品欄，需設定 productColumns');
  const result = [];
  for (let i = h+1; i < rows.length; i++) {
    const row = rows[i]; if (!row.some(v => String(v ?? '').trim())) continue;
    const lines = [];
    for (const col of columns) {
      const q = quantity(row[col.col]); if (q === 0) continue;
      const item = resolve(col.name);
      lines.push({ name: item?.name || col.name, originalName: sourceResolve(col.name)?.name || col.name, quantity:q, price:col.price ?? item?.price ?? null,
        sourceRow:i+1, sourceColumn:col.col, mapped:!!item, purchased:null, shipped:null, mailed:null });
    }
    const wish = String(row[wishCol] ?? '');
    if (!lines.length && !wish) continue;
    const name = String(row[nameCol] ?? '').trim();
    const email = String(row[emailCol] ?? '').trim().toLowerCase();
    const phone = String(row[phoneCol] ?? '').replace(/[\s\-()]/g,'');
    // Timestamp/contact bind the source. Row movement becomes a new source rather than silently inheriting history.
    const id = await digest([config.season,config.responseSheet,i+1,String(row[timeCol] ?? ''),name,email,phone]);
    result.push({id,name,email,phone,nickname:String(row[nicknameCol]??''),time:String(row[timeCol]??''),wish,
      sourceRow:i+1,sourceSheet:config.responseSheet,manual:false,lines,issues:[]});
  }
  return result;
}
function newerStockUpdate(a,b) {
  if(!b)return true;
  if(a.time===null||b.time===null)return a.time===b.time?a.row>b.row:a.time!==null;
  return a.time>b.time||a.time===b.time&&a.row>b.row;
}
export function ledger(rows, season) {
  const records = table(rows,['品項','增減數量','東收入','于收入','東支出','于支出','季別']);
  const stock = new Map(),stockUpdates=new Map(),invalidStockQuantities=new Set(); let income=0,cost=0,eastDue=0; const issues=[],transactions=[];
  // Inventory is all-history; finance is the selected season only.
  for (const r of records) {
    const name=String(r.get('品項')).trim(), raw=r.raw('增減數量'), q=raw===''?0:n(raw);
    if (!Number.isInteger(q)) {invalidStockQuantities.add(name);issues.push('金流第 '+r.row+' 列數量無法辨識');}
    if (name && q) stock.set(name,(stock.get(name)||0)+q);
    if(name && q!==null && q!==0){
      const at=String(r.get('時間戳記')||r.get('日期')),update={time:stockTime(at),at,row:r.row};
      if(newerStockUpdate(update,stockUpdates.get(name)))stockUpdates.set(name,update);
    }
    if (String(r.get('季別')).trim()!==season) continue;
    const values=['東收入','于收入','東支出','于支出'].map(k => r.get(k)===''?0:n(r.get(k)));
    const note=String(r.get('備註')).trim(),parts=note.split(/[/／]/).map(s=>s.trim());
    const salesChannel=['GM','GM採購'].includes(parts[0])?'gm':['一般','一般販售'].includes(parts[0])?'general':'unknown';
    if(salesChannel!=='unknown')parts.shift();
    const labels={'進貨':'進貨成本','進貨成本':'進貨成本','出貨':'銷貨收入','銷貨收入':'銷貨收入','其他支出':'其他成本','其他成本':'其他成本','其他收入':'其他收入','結算':'結算'};
    const settlementValue=r.get('結餘(東給于)')===''?0:n(r.get('結餘(東給于)'));
    const kind=labels[parts[0]]||(settlementValue?'結算':q<0?'銷貨收入':q>0?'進貨成本':'未分類');
    const cash=values.some(v=>v===null)?null:kind==='結算'?settlementValue:['銷貨收入','其他收入'].includes(kind)?values[0]+values[1]:['進貨成本','其他成本'].includes(kind)?values[2]+values[3]:null;
    const actor=['小東','于正'].filter((_,i)=>values[i]||values[i+2]).join('、');
    transactions.push({id:'row-'+r.row,sourceRow:r.row,transactionId:String(r.get('交易編號')).trim(),time:String(r.get('時間戳記')||r.get('日期')),kind,subject:String(r.get('顧客姓名')||r.get('客戶姓名')||r.get('姓名')||parts[1]||''),name,quantity:q,amount:cash,actor,note,income:values[0]===null||values[1]===null?null:values[0]+values[1],cost:values[2]===null||values[3]===null?null:values[2]+values[3],settlement:settlementValue});
    transactions.at(-1).salesChannel=salesChannel;
    if (values.some(v=>v===null)) {issues.push('金流第 '+r.row+' 列金額無法辨識');eastDue=null;continue;}
    income+=values[0]+values[1];cost+=values[2]+values[3];
    const settlement=r.get('結餘(東給于)')===''?0:n(r.get('結餘(東給于)'));
    if(settlement===null){issues.push('金流第 '+r.row+' 列結算金額無法辨識');eastDue=null;}
    else if(eastDue!==null)eastDue+=(values[0]+values[3]-values[2]-values[1])/2-settlement;
  }
  return {stock,stockUpdates,invalidStockQuantities,income,cost,eastDue,issues,transactions};
}
function orderedJson(value) {
  if (Array.isArray(value)) return '['+value.map(orderedJson).join(',')+']';
  if(value && typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+orderedJson(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
async function pyDigest(v) {return digestBytes(orderedJson(v));}
async function digestBytes(s) {const a=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function resource(line, order, config, kind) {
  const origin=order.manual ? [config.season,'local','local-order:'+order.manualId,line.localLineId]
    : [config.season,config.spreadsheetId,order.sourceSheet,line.sourceRow,line.sourceColumn];
  const identity=kind==='mail' ? [kind,...origin.slice(0,3),order.email.trim().toLowerCase(),norm(line.originalName)] : [kind,...origin,''];
  return {key:await pyDigest(identity),fingerprint:await pyDigest(kind==='mail'?identity:[origin,line.originalName,line.quantity])};
}
export async function compose(input, config, now = new Date().toISOString()) {
  const items = catalog(input.catalog), resolve=resolver(items,config.aliases);
  const orders = await parseResponses(input.responses,config,items);
  const team=input.team, documents=input.documents;
  if (!Array.isArray(team.resources)||!Array.isArray(team.operations)||!Array.isArray(documents.documents)) throw new Error('協作資料格式錯誤');
  if(team.teamId!==documents.teamId) throw new Error('協作團隊識別碼不一致');
  for(const doc of documents.documents.filter(d=>d.season===config.season&&d.kind==='manualOrder'&&!d.deleted)) {
    const b=doc.body;
    if(!b||!Array.isArray(b.items)) throw new Error('手動訂單資料不完整');
    orders.push({id:'manual-'+doc.id,manualId:doc.id,manual:true,name:b.name,email:b.email||'',phone:b.phone||'',nickname:'',time:b.createdAt||'',sourceSheet:'',
      lines:b.items.map(i=>({name:resolve(i.name)?.name||i.name,originalName:i.name,quantity:i.quantity,price:i.unitPrice,localLineId:i.localLineId,mapped:!!resolve(i.name),purchased:null,shipped:null,mailed:null})),issues:[]});
  }
  const resourceIndex=new Map();
  for (const r of team.resources.filter(r=>r.season===config.season)) {if(resourceIndex.has(r.key)) throw new Error('重複協作資源');resourceIndex.set(r.key,r);}
  for(const order of orders) for(const line of order.lines) {
    line.noRulesRequired=resolve(line.name)?.noRulesRequired??null;
    line.evidence={purchased:'missing',shipped:'missing',mailed:'missing'};
    if(line.quantity==null){order.issues.push('數量待核對');continue;}
    for(const [kind,field] of [['purchase','purchased'],['shipment','shipped'],['mail','mailed']]) {
      const expected=await resource(line,order,config,kind),r=resourceIndex.get(expected.key);
      if(!r){line[field]=null;continue;}
      if(r.fingerprint!==expected.fingerprint||!Number.isInteger(r.doneQuantity)||r.doneQuantity<0||r.doneQuantity>(kind==='mail'?1:line.quantity)) {
        order.issues.push(line.name+' 協作來源待核對');line.evidence[field]='conflict';line[field]=null;continue;
      }
      line[field]=r.doneQuantity;
      line.evidence[field]=r.activeOperationId?'processing':'confirmed';
    }
    if(line.shipped!==null&&line.evidence.purchased!=='conflict'){
      line.purchased=Math.max(line.purchased??0,line.shipped);
      if(line.evidence.purchased==='missing')line.evidence.purchased='shipment';
    }
    // No record is unknown, not a claim that an offline historical order never shipped.
  }
  const money=ledger(input.ledger,config.season), files=input.rules||[];
  const identify=name=>{
    const usedSuffix=/[（(]二手[）)]\s*$/;
    const used=usedSuffix.test(name),base=name.replace(usedSuffix,'').trim();
    const match=resolve(base),aliased=config.aliases?.[base]??base;
    const candidates=match?[match]:items.filter(i=>[i.name,i.foreignName].filter(Boolean).some(k=>norm(k)===norm(aliased)));
    return {used,match,candidates};
  };
  const inventory=new Map(items.map(item=>[item,{new:0,used:0,newInvalid:false,usedInvalid:false,update:null}]));
  const rawNames=new Set([...money.stock.keys(),...money.stockUpdates.keys(),...money.invalidStockQuantities]);
  for(const name of rawNames){
    const {used,match,candidates}=identify(name),key=used?'used':'new';
    for(const item of candidates){
      const inv=inventory.get(item);
      if(!match||money.invalidStockQuantities.has(name))inv[key+'Invalid']=true;
      if(!match)continue;
      inv[key]+=money.stock.get(name)||0;
      const update=money.stockUpdates.get(name);
      if(update&&newerStockUpdate(update,inv.update))inv.update=update;
    }
  }
  const unmatchedShipments=[];
  const demand=new Map(items.map(item=>[item,{new:0,used:0,newInvalid:false,usedInvalid:false}]));
  for(const tx of money.transactions){
    if(tx.kind!=='銷貨收入'||tx.salesChannel==='general'||tx.quantity===0)continue;
    const {used,match,candidates}=identify(tx.name);
    if(!match){
      money.issues.push('金流第 '+tx.sourceRow+' 列出貨品項無法唯一比對');
      unmatchedShipments.push({sourceRow:tx.sourceRow,name:tx.name,quantity:tx.quantity,used,reason:candidates.length?'ambiguous':'unmatched'});
    }
    if(tx.salesChannel==='unknown')money.issues.push('金流第 '+tx.sourceRow+' 列沿用未標示通路的出貨');
    for(const item of candidates){
      const d=demand.get(item),key=used?'used':'new';
      if(!match||!Number.isInteger(tx.quantity))d[key+'Invalid']=true;
      else d[key]-=tx.quantity;
    }
  }
  const products=items.map(item=>{
    const rows=orders.flatMap(o=>o.lines.filter(l=>l.name===item.name).map(l=>({order:o,line:l})));
    const responseOrdered=rows.every(x=>x.line.quantity!==null)?rows.reduce((a,x)=>a+x.line.quantity,0):null;
    const ordered=item.ordered===null?responseOrdered:Number.isInteger(item.ordered)&&item.ordered>=0?item.ordered:null;
    const orderQuantityMismatch=ordered!==null&&(responseOrdered===null||ordered!==responseOrdered);
    const d=demand.get(item);
    const validShipment=!d.newInvalid&&d.new>=0&&(ordered===null||d.new<=ordered);
    const shipped=validShipment?d.new:null;
    const usedShipped=!d.usedInvalid&&d.used>=0&&(item.usedOrdered===null||d.used<=item.usedOrdered)?d.used:null;
    const known=ordered!==null&&shipped!==null;
    if(!validShipment||usedShipped===null)money.issues.push(item.name+' 帳本出貨數量待核對');
    const inv=inventory.get(item),newStock=inv.newInvalid?null:inv.new,usedStock=inv.usedInvalid?null:inv.used,stockUpdate=inv.update;
    const rules=files.filter(f=>norm(f.name.replace(/_(?:中文規則書?|中文卡牌|卡表).*$/,''))===norm(item.name)).map(f=>({name:f.name,url:safeUrl(f.webViewLink||`https://drive.google.com/file/d/${encodeURIComponent(f.id)}/view`),cards:/中文卡牌|卡表/.test(f.name)}));
    if(item.ruleUrl&&!rules.some(f=>f.url===item.ruleUrl))rules.push({name:'規則檔',url:item.ruleUrl,cards:false});
    const outstanding=known?Math.max(0,ordered-shipped):null;
    const usedOutstanding=item.usedOrdered!==null&&usedShipped!==null?Math.max(0,item.usedOrdered-usedShipped):null;
    const usedShortage=usedOutstanding!==null&&usedStock!==null?Math.max(0,usedOutstanding-usedStock):null;
    const shortageEstimate=false;
    return {...item,ordered,responseOrdered,orderQuantityMismatch,orderQuantitySource:item.ordered===null?'responses':'catalog',shipped,outstanding,shipmentSource:'ledger',usedShipped,usedOutstanding,usedShortage,stock:newStock,usedStock,shortage:known&&newStock!==null?Math.max(0,outstanding-newStock):null,shortageEstimate,
      stockUpdatedAt:stockUpdate?.at||'',stockUpdatedTime:stockUpdate?.time??null,stockUpdatedRow:stockUpdate?.row??null,rules,
      customers:rows.map(x=>({id:x.order.id,name:x.order.name,mailed:x.line.mailed})),coverage:known&&!inv.newInvalid&&!inv.usedInvalid&&(item.usedOrdered===null||usedShortage!==null)?'confirmed':'unknown'};
  });
  for(const order of orders){order.total=order.lines.every(l=>l.quantity!==null&&l.price!==null)?order.lines.reduce((a,l)=>a+l.quantity*l.price,0):null;
    const knownSum=field=>order.lines.reduce((sum,l)=>sum+(l[field]??0),0);
    order.progress={total:order.lines.every(l=>l.quantity!==null)?knownSum('quantity'):null,purchased:knownSum('purchased'),shipped:knownSum('shipped'),mailed:order.lines.filter(l=>l.mailed===1).length,ruleTotal:order.lines.length,
      purchaseUnknown:order.lines.filter(l=>l.purchased===null).length,shipmentUnknown:order.lines.filter(l=>l.shipped===null).length,mailUnknown:order.lines.filter(l=>l.mailed===null).length};
    const evidence=order.lines.flatMap(l=>Object.values(l.evidence));
    order.status=evidence.includes('conflict')?'來源不一致待核對':order.issues.length?'待核對':evidence.includes('processing')?'雲端處理中':order.lines.length&&order.lines.every(l=>l.shipped===l.quantity)?'已出貨':order.lines.some(l=>l.purchased>0)?'待出貨':order.lines.length&&order.lines.every(l=>l.purchased===0&&l.shipped===0)?'尚未下單':evidence.some(x=>x!=='missing')?'部分操作尚無雲端紀錄':'尚無雲端操作紀錄';
    order.followUp=classifyFollowUp(order);
    // Do not expose contact details to the mobile app.
    delete order.email;order.phoneSuffix=order.phone?.slice(-3)||'';delete order.phone;
  }
  return {season:config.season,updatedAt:now,followUpVersion:1,inventoryVersion:3,stockCalculationVersion:1,unmatchedShipments,orders,products,finance:{income:money.income,cost:money.cost,profit:money.income-money.cost,eastDue:money.eastDue},
    transactions:money.transactions,issues:money.issues,operations:team.operations.filter(o=>o.season===config.season).map(o=>({id:o.id,actor:o.actor,kind:o.kind,status:o.status,time:o.updatedAt||o.createdAt})),
    sourceStatus:{catalog:'ok',responses:'ok',ledger:'ok',team:'ok',documents:'ok',rules:'ok'},
    summary:{orders:orders.length,attention:orders.filter(needsAttention).length,registrationPending:orders.filter(o=>o.followUp.kind==='registration').length,rulesPending:orders.filter(o=>o.followUp.kind==='rules').length,shortages:products.filter(p=>p.shortage>0||p.usedShortage>0).length,unknownStock:products.filter(p=>p.coverage==='unknown').length,
      unmatchedShipments:unmatchedShipments.length,rulesReady:products.filter(p=>p.rules.length).length,rulesTotal:products.length}};
}
export async function changes(previous, next) {
  if(!previous)return []; // First successful read establishes the baseline; no historical flood.
  const events=[],add=async(type,key,title,detail,target,time=next.updatedAt)=>events.push({id:await digest([next.season,type,key]),type,title,detail,target,time});
  const oldOrders=new Map(previous.orders.map(o=>[o.id,o]));
  for(const o of next.orders){const old=oldOrders.get(o.id);
    // An older snapshot establishes a silent migration baseline for the new reminders.
    const task=o.followUp?.kind;
    if(previous.followUpVersion===1&&['registration','rules'].includes(task)&&old?.followUp?.kind!==task)
      await add(task==='rules'?'rules-pending':task,[o.id,task,next.updatedAt],task==='registration'?'訂單待出貨登記':'訂單待寄規則','有已確認的訂單待辦，請登入查看',{page:'orders',id:o.id});
    if(!old)await add('order',o.id,'新增預購訂單','有新的訂單等待查看',{page:'orders',id:o.id});
    else if(JSON.stringify(o.lines.map(l=>[l.originalName,l.quantity,l.price]))!==JSON.stringify(old.lines.map(l=>[l.originalName,l.quantity,l.price])))
      await add('change',o.id+await digest(o.lines.map(l=>[l.originalName,l.quantity,l.price])),'訂購內容有異動','請核對品項與數量',{page:'orders',id:o.id});
  }
  const oldProducts=new Map(previous.products.map(p=>[p.name,p]));
  for(const p of next.products){const old=oldProducts.get(p.name);if(!old)continue;
    if(previous.inventoryVersion===3&&previous.stockCalculationVersion===1&&p.shortage>0&&(p.shortage!==old.shortage||!!p.shortageEstimate!==!!old.shortageEstimate))
      await add('shortage',[p.name,p.shortage,!!p.shortageEstimate,next.updatedAt],p.shortageEstimate?'庫存缺口估算提醒':'庫存不足提醒',p.shortageEstimate?p.name+' 規劃缺口估算 '+p.shortage+' 盒（非確認剩餘需求，出貨資料待核對）':p.name+' 尚缺 '+p.shortage+' 盒',{page:'inventory',name:p.name});
    if(!old.rules.length&&p.rules.length)await add('rules',p.name+await digest(p.rules),'中文規則已備齊',p.name,{page:'rules',name:p.name});
  }
  const oldOps=new Map(previous.operations.map(o=>[o.id,o]));
  for(const o of next.operations)if(o.status==='succeeded'&&oldOps.get(o.id)?.status!=='succeeded')
    await add('activity',o.id,(o.actor||'成員')+'完成'+({shipment:'出貨登記',purchase:'下單',mail:'規則寄送'}[o.kind]||'協作操作'),'雲端已確認',{page:'notifications'},o.time);
  return events;
}
