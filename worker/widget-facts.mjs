// Explicit projections keep contacts, raw notes, source locations and URLs off the desktop.
const text=(value,max=120)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
const cash=value=>Number.isFinite(value)?'$'+value.toLocaleString('en-US'):'金額待核對';
const quantity=value=>Number.isInteger(value)&&value>=0?value:'?';
export function orderFacts(order){
  const lines=(order?.lines||[]).slice(0,6).map(l=>text(l.name,50)+' ×'+quantity(l.quantity)+(Number.isFinite(l.price)?'（'+cash(l.price)+'）':''));
  if((order?.lines?.length||0)>6)lines.push('另 '+(order.lines.length-6)+' 款');
  return lines.join('、')+'；合計 '+cash(order?.total);
}
export function widgetFacts(snapshot,event){
  const target=event.target||{},order=snapshot?.orders?.find(o=>o.id===target.id);
  const labels={order:'新增訂單',change:'訂單異動',registration:'待出貨登記','rules-pending':'待寄規則',purchase:'下單已確認',shipment:'出貨已登記',mail:'規則已寄送'};
  if(order&&labels[event.type])return {title:text(order.name,40)+' · '+labels[event.type],body:orderFacts(order)};
  const product=snapshot?.products?.find(p=>p.name===target.name);
  if(event.type==='rules'&&product)return {title:text(product.name,60)+' · 中文規則更新',body:product.rules.map(r=>text(r.name,90)).slice(0,3).join('、')};
  if(event.type==='shortage'&&product)return {title:text(product.name,60)+' · 缺貨',body:'全新尚缺 '+quantity(product.shortage)+' 盒；全新庫存 '+quantity(product.stock)+' 盒'};
  if(event.type==='stock'){
    const tx=snapshot?.transactions?.find(t=>t.id===target.transactionId);
    if(tx){
      const item=snapshot.products.find(p=>[p.name,...(p.sourceNames||[])].includes(tx.name));
      const q=Number.isInteger(tx.quantity)?(tx.quantity>0?'+':'')+tx.quantity:'待核對';
      return {title:text(tx.actor,20)+' · '+text(tx.kind,20),body:text(item?.name||tx.name,70)+' '+q+' 盒；'+cash(tx.amount)+(tx.subject?'；'+text(tx.subject,40):'')};
    }
  }
  return null;
}
