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
export function classifyFollowUp(order){
  const result=(kind,reason='')=>({kind,label:followUpLabels[kind],reason});
  const lines=order.lines||[];
  if(!lines.length)return result('none');
  if(order.issues?.length||lines.some(l=>Object.values(l.evidence||{}).some(s=>s==='conflict'||s==='processing')))return result('review','訂單來源或操作狀態待核對');
  if(lines.some(l=>!Number.isInteger(l.quantity)||l.quantity<=0||!Number.isInteger(l.purchased)||!Number.isInteger(l.shipped)||l.purchased<0||l.shipped<0||l.purchased>l.quantity||l.shipped>l.quantity))return result('review','下單或出貨證據待核對');
  if(!lines.every(l=>l.purchased===l.quantity))return result('none');
  if(lines.some(l=>l.shipped<l.quantity))return result('registration');
  const remaining=lines.filter(l=>l.noRulesRequired!==true&&l.mailed!==1);
  if(remaining.some(l=>l.noRulesRequired!==false))return result('review','規則寄送需求待核對');
  if(remaining.some(l=>l.mailed!==0))return result('review','規則寄送證據待核對');
  return result(remaining.length?'rules':'none');
}
