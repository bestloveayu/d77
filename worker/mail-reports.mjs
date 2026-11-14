import {digest} from './model.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const email=value=>typeof value==='string'?value.trim().toLowerCase():'';
const iso=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export async function mailRecipients(storage,snapshot,body,season,now=Date.now()){
  const ids=body?.orderIds;
  if(!Array.isArray(ids)||!ids.length||ids.length>50||ids.some(id=>typeof id!=='string'||!id.trim()||id.length>200)||new Set(ids).size!==ids.length)fail('訂單格式不正確');
  if(body.expectedUpdatedAt!==undefined&&!iso(body.expectedUpdatedAt))fail('快照版本格式不正確');
  return storage.transaction(async tx=>{
    if(!snapshot||snapshot.season!==season||!Number.isFinite(Date.parse(snapshot.updatedAt))||now-Date.parse(snapshot.updatedAt)>900000||Date.parse(snapshot.updatedAt)>now+60000)fail('快照過期，請先重新整理',409);
    if(body.expectedUpdatedAt!==undefined&&body.expectedUpdatedAt!==snapshot.updatedAt)fail('快照版本已變更，請重新開啟預覽',409);
    const recipients=[];
    for(const id of ids){
      const order=snapshot.orders.find(o=>o.id===id);
      if(!order)fail('訂單不存在');
      const contact=await tx.get('mail-recipient:'+id);
      if(contact?.updatedAt!==snapshot.updatedAt)fail('收件人資料待更新，請先重新整理',409);
      const address=email(contact.email);
      if(contact.id!==id||!order.name||contact.name!==order.name||address.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))fail('收件人資料無效');
      recipients.push({id,name:order.name,email:address});
    }
    return {recipients,updatedAt:snapshot.updatedAt};
  });
}
export async function recordMailReport(storage,snapshot,body,actor,season,now=Date.now()){
  if(!body||typeof body!=='object'||Array.isArray(body))fail('回報格式不正確');
  const {reportId,orderIds,kind,items,sourceUpdatedAt}=body;
  if(!iso(sourceUpdatedAt))fail('快照版本格式不正確');
  if(typeof reportId!=='string'||!/^[A-Za-z0-9_-]{16,80}$/.test(reportId)||!['rules','order'].includes(kind))fail('回報識別碼或類型無效');
  for(const [list,max] of [[orderIds,50],[items,100]])if(!Array.isArray(list)||!list.length||list.length>max||list.some(s=>typeof s!=='string'||!s.trim()||s.length>200)||new Set(list).size!==list.length)fail('訂單或品項格式不正確');
  const recipient=email(body.recipient);
  if(recipient.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))fail('收件人無效');
  const fingerprint=await digest({orderIds:[...orderIds].sort(),kind,items:[...items].sort(),recipient,actor,sourceUpdatedAt});
  return storage.transaction(async tx=>{
    const key='mail-report:'+reportId,old=await tx.get(key);
    if(old){if(old.fingerprint!==fingerprint)fail('回報識別碼已用於其他內容',409);return {report:old.report,duplicate:true};}
    if(sourceUpdatedAt!==snapshot?.updatedAt)fail('快照版本已變更，請重新開啟預覽',409);
    if(!snapshot||snapshot.season!==season||!Number.isFinite(Date.parse(snapshot.updatedAt))||now-Date.parse(snapshot.updatedAt)>900000||Date.parse(snapshot.updatedAt)>now+60000)fail('快照過期，請先重新整理',409);
    const contacts=await Promise.all(orderIds.map(id=>tx.get('mail-recipient:'+id)));
    if(contacts.some(contact=>contact?.updatedAt!==snapshot.updatedAt))fail('收件人資料待更新，請先重新整理',409);
    const selected=orderIds.map(id=>{
      const order=snapshot.orders.find(o=>o.id===id),contact=contacts.find(o=>o.id===id);
      if(!order||!contact||!order.name||contact.name!==order.name||email(contact.email)!==recipient)fail('訂單收件人不一致');
      return order;
    });
    const name=selected[0].name;
    if(selected.some(o=>o.name!==name))fail('不可混合不同收件人');
    if(selected.some(o=>!o.lines.some(l=>items.includes(l.name))))fail('選取訂單沒有回報品項');
    for(const item of items){
      const lines=selected.flatMap(o=>o.lines.filter(l=>l.name===item));
      if(!lines.length)fail('品項不屬於選取訂單');
      if(kind==='rules'&&(lines.some(l=>l.noRulesRequired===true)||!snapshot.products.some(p=>p.name===item&&p.rules?.some(r=>typeof r.url==='string'&&/^https:\/\//.test(r.url)))))fail('品項沒有可寄送規則');
    }
    const index=await tx.get('mail-report-index')||[];
    if(index.length>=1000)fail('本季回報數量已達上限',429);
    const rateKey='mail-report-rate:'+await digest(actor.sub),rate=await tx.get(rateKey)||[];
    const recent=rate.filter(t=>now-t<3600000);
    if(recent.length>=30)fail('回報過於頻繁，請稍後重試',429);
    const time=new Date(now).toISOString();
    const stableSort=values=>values.sort((a,b)=>{const x=JSON.stringify(a),y=JSON.stringify(b);return x<y?-1:x>y?1:0;});
    const orders=stableSort(selected.map(order=>({id:order.id,selectedLines:stableSort(order.lines.filter(line=>items.includes(line.name)).map(line=>({name:line.name,originalName:line.originalName??line.name,quantity:line.quantity??null,price:line.price??null})))})));
    const ruleFiles=stableSort(snapshot.products.filter(product=>items.includes(product.name)).flatMap(product=>(product.rules||[]).map(file=>({item:product.name,name:file.name??'',url:file.url??''}))));
    const evidence={updatedAt:snapshot.updatedAt,orders,ruleFiles};
    if(new TextEncoder().encode(JSON.stringify(evidence)).length>64000)fail('來源證據過大，請減少選取品項',413);
    const sourceEvidence={...evidence,digest:await digest(evidence)};
    const report={reportId,season,actor,time,orderIds:[...orderIds],items:[...items],kind,recipient,name,status:'manual-pending-desktop',sourceEvidence};
    const event={id:await digest([season,'mail-report',reportId]),type:'activity',title:name+(kind==='rules'?' 規則已寄送（手機）':' 訂單通知已寄送（手機）'),detail:'品項：'+items.join('、')+'；使用者確認手動寄送；待桌面確認；操作者：'+actor.email,target:{page:'orders',id:orderIds[0]},time};
    event.widgetFacts={title:event.title,body:items.join('、')+'；待桌面確認'};
    const eventIds=await tx.get('event-index')||[],merged=[event.id,...eventIds].slice(0,150);
    await tx.put(key,{fingerprint,report});await tx.put('mail-report-index',[reportId,...index]);
    await tx.put(rateKey,[...recent,now]);await tx.put('event:'+event.id,event);await tx.put('event-index',merged);
    for(const id of eventIds)if(!merged.includes(id))await tx.delete('event:'+id);
    return {report,event,duplicate:false};
  });
}
export async function listMailReports(storage,limit=100,before){
  const ids=await storage.get('mail-report-index')||[];
  const start=before?ids.indexOf(before)+1:0;
  if(before&&start===0)fail('分頁識別碼無效');
  const page=ids.slice(start,start+limit);
  const reports=await Promise.all(page.map(async id=>(await storage.get('mail-report:'+id)).report));
  return {reports,nextCursor:start+limit<ids.length?page.at(-1):null};
}

