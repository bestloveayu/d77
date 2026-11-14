import {stockFacts} from './activity-facts.mjs';
// Explicit projections keep contacts, raw notes, source locations and URLs off the desktop.
const text=(value,max=120)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
const cash=value=>Number.isFinite(value)?'$'+value.toLocaleString('en-US'):'金額待核對';
const quantity=value=>Number.isInteger(value)&&value>=0?value:'?';
export function itemFacts(order){
  const lines=(order?.lines||[]).slice(0,12).map(l=>text(l.name,50)+' ×'+quantity(l.quantity));
  if((order?.lines?.length||0)>12)lines.push('另 '+(order.lines.length-12)+' 款');
  return lines.join('、');
}
export function orderFacts(order){
  const lines=(order?.lines||[]).slice(0,6).map(l=>text(l.name,50)+' ×'+quantity(l.quantity)+(Number.isFinite(l.price)?'（'+cash(l.price)+'）':''));
  if((order?.lines?.length||0)>6)lines.push('另 '+(order.lines.length-6)+' 款');
  return lines.join('、')+'；合計 '+cash(order?.total);
}
export function pendingFacts(order,type){
  const shipping=type==='registration'||type==='purchase';
  const lines=(order.lines||[]).flatMap(l=>{
    if(shipping){const q=Math.max(0,Math.min(l.quantity||0,l.purchased||0)-(l.shipped||0));return q?[{...l,quantity:q}]:[];}
    return l.shipped>0&&l.noRulesRequired!==true&&l.mailed!==1?[l]:[];
  });
  const title=text(order.name,40)+(shipping?' 已下單待出貨':' 已出貨待寄規則');
  if(!shipping)return {title,body:[...new Set(lines.map(l=>text(l.name,50)))].join('、')||'目前沒有待寄規則品項'};
  const known=lines.every(l=>Number.isFinite(l.price));
  return {title,body:lines.map(l=>text(l.name,50)+' ×'+l.quantity+'（'+cash(Number.isFinite(l.price)?Math.round(l.price*l.quantity*100)/100:null)+'）').join('、')+'；合計 '+cash(known?Math.round(lines.reduce((sum,l)=>sum+l.price*l.quantity,0)*100)/100:null)};
}
export function widgetFacts(snapshot,event){
  if(event.activityFacts)return {...event.activityFacts};
  if(event.type==='shortage'){
    const saved=event.widgetFacts;
    const title=(saved?.title||event.title||'').replace(/\s*(?:·\s*)?缺貨$/,' 庫存不足');
    return {title:title.includes('庫存不足')?title:'庫存不足',body:saved?.body||event.detail||'舊紀錄未保存缺貨數量'};
  }
  const target=event.target||{},order=snapshot?.orders?.find(o=>o.id===target.id);
  if(order&&['registration','purchase','rules-pending'].includes(event.type))return pendingFacts(order,event.type);
  const labels={order:'新增預購',change:'訂單異動',registration:'待出貨登記','rules-pending':'待寄規則',purchase:'下單已確認',shipment:'出貨已登記',mail:'規則已寄送'};
  if(order&&labels[event.type])return {title:text(order.name,40)+' '+labels[event.type],body:['order','mail'].includes(event.type)?itemFacts(event.type==='mail'&&Array.isArray(event.itemNames)?{lines:order.lines.filter(l=>event.itemNames.includes(l.name))}:order):orderFacts(order)};
  const product=snapshot?.products?.find(p=>p.name===target.name);
  if(event.type==='rules'&&product)return {title:text(product.name,60)+' · 中文規則更新',body:product.rules.map(r=>text(r.name,90)).slice(0,3).join('、')};
  if(event.type==='stock'){
    const tx=snapshot?.transactions?.find(t=>t.id===target.transactionId);
    if(tx){
      const item=snapshot.products.find(p=>[p.name,...(p.sourceNames||[])].includes(tx.name));
      return stockFacts(tx,item?.name||tx.name);
    }
  }
  return null;
}
