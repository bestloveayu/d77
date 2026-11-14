import {ruleLinkText} from './rule-copy.js';
const key=value=>String(value||'').normalize('NFKC').trim();
const emailKey=value=>key(value).toLowerCase();
const money=value=>'$'+Number(value).toLocaleString('zh-TW',{maximumFractionDigits:2});
export function emailGroups(orders){
 const groups=[],known=new Map();
 for(const order of orders){
  const email=emailKey(order.email),name=key(order.name),identity=email&&name?JSON.stringify([name,email]):null;
  if(identity&&known.has(identity))known.get(identity).push(order);
  else{const group=[order];groups.push(group);if(identity)known.set(identity,group);}
 }
 return groups;
}
export function emailDraft(orders,products,season='',includeRules=true){
 if(!orders.length||emailGroups(orders).length!==1)throw Error('請確認為同一位顧客及相同 Email');
 const lines=orders.flatMap(o=>o.lines||[]);
 if(!lines.length||lines.some(l=>!l.name||!Number.isInteger(l.quantity)||l.quantity<1||!Number.isFinite(l.price)||l.price<0))throw Error('品項金額待核對，請先確認');
 const total=lines.reduce((sum,l)=>sum+(l.exportShortage?0:Math.round(l.price*l.quantity*100)),0)/100;
 const selected=[...new Set(lines.filter(l=>!l.exportShortage&&!l.noRulesRequired).map(l=>l.name))];
 const available=products.filter(p=>selected.includes(p.name)&&!p.noRulesRequired&&ruleLinkText([p]));
 const ruleNames=includeRules?available.map(p=>p.name):[];
 const rules=includeRules?ruleLinkText(available):'';
 return {to:key(orders[0].email),name:key(orders[0].name),subject:`東77｜${season?season+' ':''}訂單${rules?'與中文規則':''}`,
  body:`${key(orders[0].name)}您好：\n\n訂購品項：\n${lines.map(l=>`${l.name} ×${l.quantity}，小計 ${l.exportShortage?'缺貨':money(l.price*l.quantity)}`).join('\n')}\n\n總金額：${money(total)}${rules?'\n\n中文規則：\n'+rules:''}\n\n謝謝您的訂購。`,ruleNames,total};
}
export function mailUrl(draft){
 const to=String(draft.to||'').trim();
 if(!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)||/[\r\n]/.test(to))throw Error('請填入單一有效 Email');
 return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
}
export function openEmailPreview(orders,{products=[],season='',report,isCurrent=()=>true}={}){
 const groups=emailGroups(orders.filter(o=>o.lines?.length));
 if(!groups.length){alert('請先選取顧客與品項');return;}
 const dialog=document.createElement('dialog');dialog.className='email-preview-dialog';
 dialog.innerHTML='<header><h2>Email 預覽</h2><button type="button" data-close aria-label="關閉">×</button></header><label>收件顧客<select data-customer></select></label><p data-group-note class="read-only-note"></p><label>收件人<input type="email" data-to></label><label>主旨<input data-subject></label><label class="email-rule-toggle"><input type="checkbox" data-rules checked>帶入可用的中文規則與卡牌連結</label><label>信件內容<textarea data-body></textarea></label><p class="read-only-note">開啟郵件 App 後，請自行按寄送。網站無法確認是否寄件成功；寄出後才按「我已寄送」。</p><div class="section-actions"><button type="button" data-copy>複製全文</button><a class="primary email-open" data-open>開啟 Email</a></div><fieldset data-confirm><legend>寄出後確認</legend><label><input type="checkbox" data-ack>我已確認信件寄出，收件人及下列品項正確</label><div data-items></div><button type="button" data-report disabled>我已寄送</button><p class="read-only-note">只留下手機寄送回報，正式規則狀態仍待桌面確認。</p></fieldset><p role="status"></p>';
 const $=s=>dialog.querySelector(s),states=groups.map(group=>({group,draft:emailDraft(group,products,season),id:crypto.randomUUID(),done:false,opened:false,payload:null}));
 let index=0,working=false;const current=()=>states[index];
 const status=message=>$('[role=status]').textContent=message;
 const select=$('[data-customer]');
 groups.forEach((group,i)=>{const option=document.createElement('option');option.value=i;option.textContent=group[0].name+' · '+group.length+' 筆訂單';select.append(option);});
 function read(){const s=current();s.draft={...s.draft,to:$('[data-to]').value,subject:$('[data-subject]').value,body:$('[data-body]').value};}
 function updateLink(){
  read();try{const href=mailUrl(current().draft);$('[data-open]').href=href;$('[data-open]').removeAttribute('aria-disabled');}
  catch{$('[data-open]').removeAttribute('href');$('[data-open]').setAttribute('aria-disabled','true');}
 }
 function updateConfirm(){
  const s=current(),same=emailKey($('[data-to]').value)===emailKey(s.group[0].email);
  $('[data-report]').disabled=working||s.done||!s.opened||!same||!$('[data-ack]').checked||(!s.payload&&!isCurrent())||!report;
 }
 function fill(){
  const s=current();$('[data-to]').value=s.draft.to;$('[data-subject]').value=s.draft.subject;$('[data-body]').value=s.draft.body;
  $('[data-rules]').checked=!!s.draft.ruleNames.length;
  $('[data-group-note]').textContent=groups.length>1?'不同顧客分開編輯與寄送，請逐位處理。':s.group.length>1?'同姓名、同 Email 的訂單合併為本次信件，不會實際併單。':'';
  $('[data-ack]').checked=false;$('[data-items]').replaceChildren();
  for(const name of s.draft.ruleNames){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=true;check.value=name;check.dataset.ruleItem='';label.append(check,' '+name);$('[data-items]').append(label);}
  dialog.querySelectorAll('input,textarea').forEach(x=>x.disabled=!!s.payload);
  if(s.payload)$('[data-ack]').checked=true;
  status(s.done?'此封已留下手機回報，未再次寫入。':s.payload?'前次回報結果待確認；請重試同一筆回報，勿重新建立。':'');updateLink();updateConfirm();
 }
 select.onchange=()=>{read();index=Number(select.value);fill();};
 for(const field of ['[data-to]','[data-subject]','[data-body]'])$(field).oninput=()=>{updateLink();updateConfirm();};
 $('[data-rules]').onchange=()=>{current().draft=emailDraft(current().group,products,season,$('[data-rules]').checked);current().id=crypto.randomUUID();current().opened=false;fill();};
 $('[data-ack]').onchange=updateConfirm;
 $('[data-copy]').onclick=async()=>{read();try{await navigator.clipboard.writeText('主旨：'+current().draft.subject+'\n\n'+current().draft.body);current().opened=true;status('已複製；請至郵件 App 寄出後，再回來確認。');updateConfirm();}catch{$('[data-body]').focus();$('[data-body]').select();status('請手動複製文字');}};
 $('[data-open]').onclick=e=>{updateLink();if(!isCurrent()||!$('[data-open]').hasAttribute('href')){e.preventDefault();status('請確認登入狀態及收件人 Email');return;}current().opened=true;updateConfirm();};
 $('[data-report]').onclick=async()=>{
  if(working)return;read();const s=current();if(!s.payload&&!isCurrent()){status('來源已更新，請重新預覽；不要重複寄信。');return;}
  if(s.done||!$('[data-ack]').checked||emailKey(s.draft.to)!==emailKey(s.group[0].email))return;
  const ruleNames=[...dialog.querySelectorAll('[data-rule-item]:checked')].map(x=>x.value);
  working=true;select.disabled=true;dialog.querySelectorAll('input,textarea,[data-rules]').forEach(x=>x.disabled=true);updateConfirm();status('正在儲存手機回報…');
  const items=ruleNames.length?ruleNames:[...new Set(s.group.flatMap(o=>o.lines.filter(l=>!l.exportShortage).map(l=>l.name)))];
  s.payload??={reportId:s.id,orderIds:s.group.filter(o=>o.lines.some(l=>items.includes(l.name))).map(o=>o.id),kind:ruleNames.length?'rules':'order',items,recipient:s.group[0].email};
  try{await report(s.payload);s.done=true;status('手機回報已儲存，正式規則狀態仍待桌面確認。');}
  catch(e){status(e.message+'；若逾時可重試同一筆回報，不會重複建立。');}
  finally{working=false;select.disabled=false;dialog.querySelectorAll('input,textarea').forEach(x=>x.disabled=!!s.payload);updateConfirm();}
 };
 $('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 document.body.append(dialog);fill();dialog.showModal();return dialog;
}

