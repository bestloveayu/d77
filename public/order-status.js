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
  return [
    {text:(p.purchaseUnknown?'下單已確認 ':'已下單 ')+p.purchased+'/'+(p.total??'?')+(p.purchaseUnknown?'（部分無紀錄）':''),good:!p.purchaseUnknown&&p.purchased===p.total},
    {text:(p.shipmentUnknown?'出貨已確認 ':'已出貨 ')+p.shipped+'/'+(p.total??'?')+(p.shipmentUnknown?'（部分無紀錄）':''),good:!p.shipmentUnknown&&p.shipped===p.total},
    {text:'規則已寄 '+p.mailed+'/'+p.ruleTotal+(p.mailUnknown?'（部分無紀錄）':''),good:!p.mailUnknown&&p.mailed===p.ruleTotal}
  ];
}

