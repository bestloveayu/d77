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
  const sync=()=>{count.textContent='已選 '+selected.size+' 款';bar.hidden=!selected.size;spacer.hidden=!selected.size;};
  for(const row of root.querySelectorAll('.rule-row')){
    const name=row.querySelector('[data-rule]')?.dataset.rule;
    if(!available.has(name))continue;
    const input=document.createElement('input');input.type='checkbox';input.className='rule-copy-check';
    input.setAttribute('aria-label','選取 '+name+' 的規則連結');input.checked=selected.has(name);
    input.onchange=()=>{if(input.checked)selected.add(name);else selected.delete(name);sync();};
    row.prepend(input);
  }
  button.onclick=()=>{
    const value=ruleLinkText([...selected].map(n=>available.get(n)));
    if(!value)return;
    openDialog('規則連結',`<textarea class="rule-copy-text" readonly aria-label="規則連結文字">${esc(value)}</textarea><div class="order-export-actions"><button type="button" data-rule-copy-again>複製文字</button><span data-rule-copy-status role="status"></span></div>`);
    const field=document.querySelector('.rule-copy-text'),status=document.querySelector('[data-rule-copy-status]');
    const copy=async()=>{
      try{await navigator.clipboard.writeText(value);status.textContent='已複製';}
      catch{field.focus();field.select();status.textContent='請長按選取並複製';}
    };
    document.querySelector('[data-rule-copy-again]').onclick=copy;
    void copy();
  };
  bar.append(count,button);nav.append(bar);root.append(spacer);sync();
}
