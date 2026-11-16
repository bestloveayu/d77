export function compareStockUpdated(a,b){
  const stamp=p=>Number.isFinite(p.stockUpdatedTime)?p.stockUpdatedTime:0;
  const row=p=>Number.isFinite(p.stockUpdatedRow)?p.stockUpdatedRow:0;
  return stamp(b)-stamp(a)||row(b)-row(a)||a.name.localeCompare(b.name,'zh-TW');
}
export function recentShortages(products,limit=4){
  return products.filter(p=>p.shortage>0||p.usedShortage>0).sort(compareStockUpdated).slice(0,limit);
}
