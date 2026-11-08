function files(product){
  const seen=new Set();
  return (product.rules||[]).flatMap(f=>{
    try{
      const url=new URL(f.url);
      const label=f.cards?'中文卡牌／卡表':'中文規則';
      const key=label+url.href;
      if(url.protocol!=='https:'||url.username||url.password||seen.has(key))return [];
      seen.add(key);return [{label,url:url.href}];
    }catch{return [];}
  });
}

export function ruleLinkText(products){
  return products.map(p=>{
    const links=files(p);
    return links.length?'【'+p.name+'】\n'+links.map(f=>f.label+'：'+f.url).join('\n'):'';
  }).filter(Boolean).join('\n\n');
}

const selected=new Set();
let season='';

export function resetRuleCopy(nextSeason){
  if(nextSeason!==season){selected.clear();season=nextSeason;}
  document.querySelector('#nav .rule-copy-dock')?.remove();
}

export function mountRuleCopy(root,nav,products,openDialog,esc){
  const available=new Map(products.filter(p=>files(p).length).map(p=>[p.name,p]));
  for(const name of selected)if(!available.has(name))selected.delete(name);
  const bar=document.createElement('div');bar.className='order-export-actions order-export-dock rule-copy-dock';
  const count=document.createElement('span');count.setAttribute('aria-live','polite');
  const button=document.createElement('button');button.type='button';
  button.innerHTML='<i data-lucide="copy" aria-hidden="true"></i> 產生並複製';
  const spacer=document.createElement('div');spacer.className='order-export-spacer';
  const all=document.createElement('input');all.type='checkbox';
  const label=document.createElement('label');label.append(all,'全選');
  const group=document.createElement('div');group.className='export-dock-selection';group.append(count,label);
  const updates=[];
  const sync=()=>{
    count.textContent='已選 '+selected.size+' 款';bar.hidden=!selected.size;spacer.hidden=!selected.size;
    all.checked=selected.size===available.size;all.indeterminate=selected.size>0&&selected.size<available.size;
  };
  all.onchange=()=>{
    selected.clear();if(all.checked)for(const name of available.keys())selected.add(name);
    updates.forEach(update=>update());globalThis.lucide?.createIcons();sync();
  };
  for(const row of root.querySelectorAll('.rule-row')){
    const name=row.querySelector('[data-rule]')?.dataset.rule;
    if(!available.has(name))continue;
    const art=row.querySelector('.rule-art');
    if(!art)continue;
    const toggle=document.createElement('button');toggle.type='button';toggle.className='rule-art rule-copy-toggle';
    const update=()=>{
      const checked=selected.has(name);
      toggle.setAttribute('aria-pressed',String(checked));
      toggle.setAttribute('aria-label',name+' 的規則連結');
      toggle.title=checked?'取消選取規則連結':'選取規則連結';
      toggle.innerHTML=checked?'<i data-lucide="check" aria-hidden="true"></i>':'<i data-lucide="book-open-check" aria-hidden="true"></i>';
    };
    toggle.onclick=()=>{if(selected.has(name))selected.delete(name);else selected.add(name);update();globalThis.lucide?.createIcons();sync();};
    updates.push(update);update();art.replaceWith(toggle);
  }
  button.onclick=()=>{
    const value=ruleLinkText([...selected].map(n=>available.get(n)));
    if(!value)return;
    openDialog('規則連結',`<textarea class="rule-copy-text" aria-label="規則連結文字">${esc(value)}</textarea><div class="order-export-actions"><button type="button" data-rule-copy-again>複製文字</button><span data-rule-copy-status role="status"></span></div>`);
    const field=document.querySelector('.rule-copy-text'),status=document.querySelector('[data-rule-copy-status]');
    const copy=async()=>{
      const text=field.value;
      try{await navigator.clipboard.writeText(text);if(field.value===text)status.textContent='已複製';}
      catch{field.focus();field.select();status.textContent='請長按選取並複製';}
    };
    document.querySelector('[data-rule-copy-again]').onclick=copy;
    field.oninput=()=>{status.textContent='';};
    void copy();
  };
  bar.append(group,button);nav.append(bar);root.append(spacer);sync();
}
