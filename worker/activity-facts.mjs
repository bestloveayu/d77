const signature=r=>JSON.stringify([r.name||'',r.url||'',!!r.cards,r.modifiedTime||'']);
const key=r=>r.id||r.url||r.name;
export function shortageFacts(product){
 const value=n=>Number.isInteger(n)&&n>=0?n:'待核對';
 const lines=[];
 if(product.shortage>0)lines.push('全新缺 '+value(product.shortage)+' 盒 · 全新庫存 '+value(product.stock)+' 盒');
 if(product.usedShortage>0)lines.push('二手缺 '+value(product.usedShortage)+' 盒 · 二手庫存 '+value(product.usedStock)+' 盒');
 return {title:product.name+' 庫存不足',body:lines.join('；')||'缺貨數量待核對'};
}
export function ruleChanges(before=[],after=[]){
 const old=new Map(before.map(r=>[key(r),signature(r)]));
 return after.filter(r=>old.get(key(r))!==signature(r));
}
export function ruleFacts(name,files=[]){
 const cards=files.some(r=>r.cards),rules=files.some(r=>!r.cards);
 return {title:name+' '+(cards&&rules?'規則與卡牌更新':cards?'中文卡牌更新':'中文規則更新'),body:files.map(r=>r.name).filter(Boolean).join('、')};
}
export function stockFacts(tx,name=tx?.name){
 if(!tx||!Number.isInteger(tx.quantity)||!tx.quantity)return null;
 const used=/[（(]二手[）)]\s*$/.test(tx.name||'');
 const product=String(name||'品項待核對').replace(/[（(]二手[）)]\s*$/,'');
 const actors=String(tx.actor||'').split('、').filter(Boolean);
 return {title:product+' 庫存'+(tx.quantity>0?'增加':'減少'),body:(used?'二手':'全新')+' '+(tx.quantity>0?'+':'−')+Math.abs(tx.quantity)+' 盒 · '+(actors.length?actors.map(a=>a+'登記').join('、'):'登記人待確認')};
}
