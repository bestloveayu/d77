export function stageLabel(line,field){
  const state=line.evidence?.[field],value=line[field];
  const verb={purchased:'下單',shipped:'出貨',mailed:'規則寄送'}[field];
  if(state==='conflict')return verb+'來源不一致待核對';
  if(state==='processing')return verb+'處理中';
  if(value==null)return verb+'尚無雲端紀錄';
  if(field==='mailed')return value===1?'規則已寄出':'規則尚未寄出';
  return (value>0?'已':'尚未')+verb+' '+value+'/'+(line.quantity??'?');
}
export function orderProgressLabels(order){
  const p=order.progress;if(!p)return [];
  const shippedComplete=!p.shipmentUnknown&&p.total>0&&p.shipped===p.total;
  const shipmentText=shippedComplete?'已出貨登記 '+p.shipped+'/'+p.total:'待出貨登記 '+Math.max(0,(p.purchased||0)-(p.shipped||0))+'/'+(p.total??'?')+(p.shipmentUnknown?'（部分無紀錄）':'');
  return [
    {text:(p.purchaseUnknown?'下單已確認 ':'已下單 ')+p.purchased+'/'+(p.total??'?')+(p.purchaseUnknown?'（部分無紀錄）':''),good:!p.purchaseUnknown&&p.purchased===p.total},
    {text:shipmentText,good:shippedComplete},
    {text:'規則已寄 '+p.mailed+'/'+p.ruleTotal+(p.mailUnknown?'（部分無紀錄）':''),good:!p.mailUnknown&&p.mailed===p.ruleTotal}
  ];
}
