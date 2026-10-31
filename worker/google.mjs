import { SignJWT, importPKCS8, createRemoteJWKSet, jwtVerify } from 'jose';
import { compose, decodeTeam } from './model.mjs';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
let access;
export async function authenticate(request,env) {
  const token=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
  if(!token)throw Object.assign(new Error('請先登入'),{status:401});
  const {payload}=await jwtVerify(token,keys,{audience:env.GOOGLE_CLIENT_ID,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256']});
  const email=String(payload.email||'').toLowerCase();
  const allowed=String(env.ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(payload.email_verified!==true||!payload.sub||!allowed.includes(email)||!email.endsWith('@gmail.com'))throw Object.assign(new Error('此帳號沒有看板存取權限'),{status:403});
  return {sub:payload.sub,email};
}
async function serviceToken(env) {
  if(access?.until>Date.now()+60000)return access.token;
  let account;try{account=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT||'null');}catch{throw new Error('服務帳號金鑰格式不正確');}
  if(!account?.private_key||!account.client_email)throw new Error('尚未設定雲端唯讀服務帳號');
  const key=await importPKCS8(account.private_key,'RS256');
  const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly'})
    .setProtectedHeader({alg:'RS256',typ:'JWT'}).setIssuer(account.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('服務帳號授權失敗，請檢查私鑰與 API 設定');
  const data=await r.json();if(!data.access_token)throw new Error('Google 授權回應不完整');
  access={token:data.access_token,until:Date.now()+Math.min(data.expires_in||3600,3600)*1000};return access.token;
}
async function get(url,token) {
  const response=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new Error(response.status===403?'讀取權限不足，請將資料來源以檢視者分享給服務帳號':response.status===404?'找不到雲端分頁或資料夾':response.status===429?'Google 讀取額度暫時不足':'Google 讀取失敗（'+response.status+'）');
  return response.json();
}
export async function collect(env,sourceConfig) {
  const config=sourceConfig||JSON.parse(env.SHEET_CONFIG||'{}');
  if(!/^\d{4}[春秋]$/.test(config.season)||['spreadsheetId','catalogSheet','responseSheet','ledgerSheet','rulesFolderId'].some(k=>!config[k]||config[k].includes('REPLACE')))throw new Error('尚未完成雲端來源設定');
  const token=await serviceToken(env);
  const url=new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}/values:batchGet`);
  const sheets=[config.catalogSheet,config.responseSheet,config.ledgerSheet,config.teamSheet,config.documentsSheet];
  for(const sheet of sheets)url.searchParams.append('ranges',"'"+sheet.replace(/'/g,"''")+"'");
  url.searchParams.set('valueRenderOption','FORMATTED_VALUE');
  const data=await get(url,token);
  if(data.valueRanges?.length!==sheets.length)throw new Error('試算表讀取回應不完整');
  let pageToken;const rules=[];
  do {
    const drive=new URL('https://www.googleapis.com/drive/v3/files');
    drive.searchParams.set('q',"'"+config.rulesFolderId.replace(/'/g,"\\'")+"' in parents and trashed = false");
    drive.searchParams.set('fields','nextPageToken,files(id,name,webViewLink,modifiedTime)');drive.searchParams.set('pageSize','1000');drive.searchParams.set('supportsAllDrives','true');drive.searchParams.set('includeItemsFromAllDrives','true');
    if(pageToken)drive.searchParams.set('pageToken',pageToken);
    const page=await get(drive,token);rules.push(...(page.files||[]));pageToken=page.nextPageToken;
    if(rules.length>10000)throw new Error('規則檔案超過看板讀取上限');
  }while(pageToken);
  const [catalog,responses,ledger,team,documents]=data.valueRanges.map(v=>v.values||[]);
  return compose({catalog,responses,ledger,team:decodeTeam(team),documents:decodeTeam(documents),rules},config);
}
