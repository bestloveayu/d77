export const SOURCE_DEFAULTS={ledgerSheet:'金流進出貨總表',teamSheet:'_collaboration_v1',documentsSheet:'_collaboration_orders_v1'};
function sourceId(value,kind){
  let result=String(value??'').trim();
  if(result.startsWith('https://')){
    const u=new URL(result),m=kind==='book'&&u.hostname==='docs.google.com'?u.pathname.match(/^\/spreadsheets\/d\/([\w-]+)(?:\/|$)/):kind==='folder'&&u.hostname==='drive.google.com'?u.pathname.match(/\/folders\/([\w-]+)(?:\/|$)/):null;
    if(!m)throw new Error(kind==='book'?'請填入 Google 試算表網址或 ID':'請填入 Google Drive 資料夾網址或 ID');
    result=m[1];
  }
  if(!/^[A-Za-z0-9_-]{5,160}$/.test(result)||result.includes('REPLACE'))throw new Error(kind==='book'?'試算表 ID 格式不正確':'規則資料夾 ID 格式不正確');
  return result;
}
function sheet(value,label){const text=String(value??'').trim();if(!text||text.length>100||/^[=+@]|[\r\n\x00-\x1f]/.test(text))throw new Error(label+'格式不正確');return text;}
function object(value,label){if(typeof value==='string'){try{value=JSON.parse(value||'{}');}catch{throw new Error(label+'必須是有效 JSON');}}if(value==null)return {};if(typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>12000)throw new Error(label+'格式不正確');return value;}
export function normalizeConfig(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('季別設定格式不正確');
  const fields=['season','spreadsheetId','catalogSheet','responseSheet','ledgerSheet','teamSheet','documentsSheet','rulesFolderId','aliases','productColumns'];
  if(Object.keys(input).some(k=>!fields.includes(k)))throw new Error('含有不支援的來源設定欄位');
  const season=String(input.season??'').trim();if(!/^\d{4}[春秋]$/.test(season))throw new Error('季別請使用年份加春或秋，例如 2027春');
  const aliases=object(input.aliases,'品項名稱對照'),columns=object(input.productColumns,'商品欄位設定');
  for(const [key,value] of Object.entries(aliases)){if(!key.trim()||key.length>300||typeof value!=='string'||!value.trim()||value.length>300||['__proto__','constructor','prototype'].includes(key))throw new Error('品項名稱對照格式不正確');}
  for(const [key,value] of Object.entries(columns))if(!/^\d{1,3}$/.test(key)||(value!==false&&(!value||typeof value.name!=='string'||!value.name.trim()||typeof value.price!=='number'||!Number.isFinite(value.price)||value.price<0)))throw new Error('商品欄位設定格式不正確');
  const sorted=v=>Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)));
  return {season,spreadsheetId:sourceId(input.spreadsheetId,'book'),catalogSheet:sheet(input.catalogSheet,'品項統計分頁'),responseSheet:sheet(input.responseSheet,'預購回應分頁'),
    ledgerSheet:sheet(input.ledgerSheet??SOURCE_DEFAULTS.ledgerSheet,'金流分頁'),teamSheet:sheet(input.teamSheet??SOURCE_DEFAULTS.teamSheet,'協作分頁'),documentsSheet:sheet(input.documentsSheet??SOURCE_DEFAULTS.documentsSheet,'訂單協作分頁'),rulesFolderId:sourceId(input.rulesFolderId,'folder'),aliases:sorted(aliases),productColumns:sorted(columns)};
}
