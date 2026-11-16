export const followUpLabels={registration:'待出貨登記',rules:'待寄規則',review:'待核對',none:''};
export const notificationChoices=[['order','新訂單'],['change','訂單異動'],['shortage','缺貨提醒'],['rules','規則完成'],['activity','協作動態'],['registration','待出貨登記'],['rules-pending','待寄規則']];
export const notificationTypes=notificationChoices.map(([type])=>type);
export const needsAttention=order=>order.status!=='已出貨'||['registration','rules','review'].includes((order.followUp||classifyFollowUp(order)).kind);
export function awaitingPurchase(order){
  const lines=order.lines||[];
  if(!lines.length||order.issues?.length||lines.some(l=>!Number.isInteger(l.quantity)||l.quantity<=0||Object.values(l.evidence||{}).some(v=>v==='conflict'||v==='processing')))return false;
  const confirmed=order.progress?.purchased??lines.reduce((sum,l)=>sum+(l.purchased??0),0);
  return confirmed===0;
}
export function followUpFlags(order){
  const result=(registration=false,rules=false,review=false,reason='')=>({registration,rules,review,reason});
  const lines=order.lines||[];
  if(!lines.length)return result();
  if(order.issues?.length||lines.some(l=>Object.values(l.evidence||{}).some(s=>s==='conflict'||s==='processing')))return result(false,false,true,'訂單來源或操作狀態待核對');
  if(lines.some(l=>!Number.isInteger(l.quantity)||l.quantity<=0||['purchased','shipped'].some(k=>l[k]!=null&&(!Number.isInteger(l[k])||l[k]<0||l[k]>l.quantity))))return result(false,false,true,'下單或出貨證據待核對');
  // Missing resources are not zero quantities; they can still require a follow-up.
  const registration=lines.some(l=>l.purchased>0&&(l.shipped==null||l.shipped<l.purchased));
  const remaining=lines.filter(l=>l.shipped>0&&l.noRulesRequired!==true&&l.mailed!==1);
  if(remaining.some(l=>l.mailed!=null&&l.mailed!==0))return result(false,false,true,'規則寄送證據待核對');
  return result(registration,remaining.length>0,false,registration&&lines.some(l=>l.shipped==null)?'已確認下單，尚無完整出貨登記紀錄':remaining.some(l=>l.noRulesRequired!==false)?'尚無完整寄送紀錄；規則寄送需求待核對':'');
}
export function classifyFollowUp(order){
  const flags=followUpFlags(order),kind=flags.review?'review':flags.registration?'registration':flags.rules?'rules':'none';
  return {kind,label:followUpLabels[kind],reason:flags.reason};
}

