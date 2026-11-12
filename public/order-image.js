(() => {
  const money = n => new Intl.NumberFormat('zh-TW', {maximumFractionDigits: 2}).format(n);
  const cents = n => Math.round(n * 100);
  const nameKey = s => String(s || '').normalize('NFKC').trim();
  const valid = o => nameKey(o.name) && Number.isFinite(o.total) && o.total >= 0 && o.lines?.length &&
    o.lines.every(l => l.name && Number.isInteger(l.quantity) && l.quantity > 0 && Number.isFinite(l.price) && l.price >= 0) &&
    o.lines.reduce((sum,l) => sum + cents(l.quantity*l.price),0) === cents(o.total);
  const safeName = s => String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,60);
  const exportTotal=lines=>lines.reduce((sum,line)=>sum+(line.exportShortage?0:cents(line.quantity*line.price)),0)/100;
  const validDraft=o=>valid({...o,total:o.lines.reduce((sum,l)=>sum+cents(l.quantity*l.price),0)/100})&&cents(o.total)===cents(exportTotal(o.lines));
  function toggleExportShortage(orders,orderIndex,lineIndex){
    return orders.map((order,oi)=>{
      const lines=order.lines.map((line,li)=>({...line,...(oi===orderIndex&&li===lineIndex?{exportShortage:!line.exportShortage}:{})}));
      return {...order,lines,total:exportTotal(lines)};
    });
  }
  function removeExportLine(orders,orderIndex,lineIndex){
    return orders.map((order,index)=>{
      const lines=order.lines.filter((_,i)=>index!==orderIndex||i!==lineIndex).map(line=>({...line}));
      return {...order,lines,total:exportTotal(lines)};
    });
  }
  async function cover(url) {
    if (!url) return null;
    try {
      const local = new URL(url,location.href);
      if (local.origin !== location.origin) return null;
      const img = new Image();
      img.src = local.href;
      await img.decode();
      return img;
    } catch { return null; }
  }
  function wrap(ctx, value, width) {
    const lines=[]; let line='';
    for (const ch of String(value)) {
      if (line && ctx.measureText(line+ch).width>width) { lines.push(line); line=''; }
      line+=ch;
    }
    lines.push(line);
    return lines;
  }
  async function image(orders, season) {
    if (!orders.length || !orders.every(validDraft)) throw Error('有訂單金額待核對');
    const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
    const font=(size,bold=false)=>`${bold?'bold ':''}${size}px "Microsoft JhengHei","PingFang TC",sans-serif`;
    ctx.font=font(27);
    const sections=[];
    for (const order of orders) {
      const rows=[];
      for (const l of order.lines) {
        const img=await cover(l.cover);
        const lines=wrap(ctx,l.name,img?240:312);
        rows.push({l,img,lines,height:Math.max(img?78:56,lines.length*35+18)});
      }
      sections.push({order,rows});
    }
    const grouped=orders.length>1;
    const height=231+sections.reduce((sum,s)=>sum+44+(grouped?79:0)+s.rows.reduce((n,r)=>n+r.height,0),0);
    if (height>10000) throw Error('圖片太長，請分開下載');
    canvas.width=720; canvas.height=height;
    function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
    function label(s,x,y,size=27,color='#203730',align='left',bold=false,maxWidth=656){
      ctx.font=font(size,bold);ctx.fillStyle=color;ctx.textBaseline='middle';ctx.textAlign=align;ctx.fillText(s,x,y,maxWidth);
    }
    rect(0,0,720,height,'#ffffff');rect(0,0,720,110,'#183f34');
    label('東77桌遊',32,31,22,'#cae6d9');label('顧客訂單明細',32,76,37,'#ffffff','left',true);
    label(nameKey(orders[0].name),32,141,28,'#203730','left',true,460);label(season||'',688,141,23,'#48665b','right',170);
    let y=169;
    sections.forEach(({order,rows},i)=>{
      if(grouped){label('訂單 '+(i+1),32,y+17,24,'#375b4f');y+=37;}
      rect(32,y,656,40,'#edf4f0');
      label('品項',43,y+20,22);label('數量',429,y+20,22,'#48665b','right');
      label('單價',553,y+20,22,'#48665b','right');label('小計',677,y+20,22,'#48665b','right');y+=44;
      rows.forEach(({l,img,lines,height:h})=>{
        if(l.exportShortage)rect(32,y,656,h,'#fff4d9');
        if(img){
          const side=Math.min(img.naturalWidth,img.naturalHeight);
          ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,43,y+(h-60)/2,60,60);
        }
        lines.forEach((line,j)=>label(line,img?115:43,y+h/2+(j-(lines.length-1)/2)*35));
        label(String(l.quantity),429,y+h/2,25,'#203730','right',false,64);
        label(l.exportShortage?'缺貨':'$'+money(l.price),553,y+h/2,24,l.exportShortage?'#865b16':'#203730','right',false,112);
        label(l.exportShortage?'缺貨':'$'+money(cents(l.price*l.quantity)/100),677,y+h/2,24,l.exportShortage?'#865b16':'#203730','right',false,112);
        y+=h;rect(32,y-1,656,1,'#e3ebe7');
      });
      if(grouped){label('訂單小計',43,y+20,22);label('$'+money(order.total),677,y+20,24,'#203730','right');y+=42;}
    });
    rect(32,y+10,656,48,'#e1efe8');label('品項總計',43,y+34,25);
    label('NT$ '+money(orders.reduce((n,o)=>n+cents(o.total),0)/100),677,y+34,34,'#123e30','right',true);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('無法產生圖片')),'image/png'));
  }
  function crc32(bytes) {
    let crc=0xffffffff;
    for (const b of bytes) { crc^=b; for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
    return (crc^0xffffffff)>>>0;
  }
  async function zip(files) {
    const chunks=[], directory=[];let offset=0, size=0;
    for(const f of files){
      const name=new TextEncoder().encode(f.name), bytes=new Uint8Array(await f.blob.arrayBuffer()), crc=crc32(bytes);
      const header=new Uint8Array(30+name.length), h=new DataView(header.buffer);
      h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,2048,true);h.setUint16(12,33,true);
      h.setUint32(14,crc,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,name.length,true);
      header.set(name,30);chunks.push(header,bytes);
      const entry=new Uint8Array(46+name.length), e=new DataView(entry.buffer);
      e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);entry.set(header.subarray(6,28),8);
      e.setUint32(42,offset,true);entry.set(name,46);directory.push(entry);
      size+=entry.length;offset+=header.length+bytes.length;
    }
    const tail=new Uint8Array(22), t=new DataView(tail.buffer);
    t.setUint32(0,0x06054b50,true);t.setUint16(8,files.length,true);t.setUint16(10,files.length,true);
    t.setUint32(12,size,true);t.setUint32(16,offset,true);
    return new Blob([...chunks,...directory,tail],{type:'application/zip'});
  }
  function open(orders,{season='',share=false}={}){
    if(!orders.length){alert('請先勾選要匯出的顧客訂單。');return;}
    const originals=orders.filter(valid).map(o=>({...o,lines:o.lines.map(l=>({...l}))})),skipped=orders.filter(o=>!valid(o));
    let good=originals.map(o=>({...o,lines:o.lines.map(l=>({...l}))})),combine=false;
    const dialog=document.createElement('dialog');dialog.className='order-image-dialog';
    dialog.innerHTML='<h2>訂單圖片</h2><div class="order-image-controls"></div><div class="order-image-editor"></div><p role="status"></p><img alt="訂單圖片預覽" hidden><div class="order-image-actions"><button type="button" data-close>關閉</button><a hidden download>下載</a><button type="button" data-share hidden>分享圖片</button></div>';
    const status=dialog.querySelector('[role=status]'),img=dialog.querySelector('img'),link=dialog.querySelector('a'),shareBtn=dialog.querySelector('[data-share]');
    const note=skipped.length?'未匯出：'+skipped.map(o=>o.name||'姓名未確認').join('、')+'（金額或品項待核對）':'';
    let url='', sequence=0, file=null;
    const clear=()=>{if(url)URL.revokeObjectURL(url);url='';file=null;img.hidden=true;img.removeAttribute('src');link.hidden=true;link.removeAttribute('href');shareBtn.hidden=true;};
    dialog.addEventListener('close',()=>{sequence++;clear();dialog.remove();},{once:true});
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    shareBtn.onclick=async()=>{try{if(file)await navigator.share({files:[file]});}catch(e){if(e.name!=='AbortError')status.textContent='分享失敗，請改用下載圖片。';}};
    function renderEditor(){
      const editor=dialog.querySelector('.order-image-editor');editor.replaceChildren();
      good.forEach((order,oi)=>{
        const section=document.createElement('section'),heading=document.createElement('h3');
        heading.textContent=(good.length>1?'訂單 '+(oi+1)+' · ':'')+order.name;section.append(heading);
        order.lines.forEach((line,li)=>{
          const row=document.createElement('div');row.className='order-image-edit-row';
          const name=document.createElement('span'),sum=document.createElement('span'),remove=document.createElement('button'),shortage=document.createElement('button');
          name.textContent=line.name+' ×'+line.quantity;sum.textContent=line.exportShortage?'缺貨':'$'+money(cents(line.price*line.quantity)/100);sum.className='order-image-edit-price';
          shortage.type='button';shortage.className='order-image-shortage';shortage.textContent='缺貨';shortage.setAttribute('aria-pressed',String(!!line.exportShortage));shortage.setAttribute('aria-label',line.name+' 缺貨');shortage.title=line.exportShortage?'取消缺貨標記':'在本次圖片標記缺貨';
          shortage.onclick=()=>{good=toggleExportShortage(good,oi,li);renderEditor();prepare();};
          remove.type='button';remove.className='order-image-remove';remove.textContent='×';remove.title='從本次圖片移除 '+line.name;remove.setAttribute('aria-label',remove.title);
          remove.onclick=()=>{good=removeExportLine(good,oi,li);renderEditor();prepare();};
          row.append(name,sum,shortage,remove);section.append(row);
        });
        if(!order.lines.length){const empty=document.createElement('p');empty.textContent='本筆已無匯出品項';section.append(empty);}
        editor.append(section);
      });
      const total=document.createElement('p');total.className='order-image-edit-total';total.textContent='圖片品項總計：NT$ '+money(good.reduce((sum,o)=>sum+cents(o.total),0)/100);
      const reset=document.createElement('button');reset.type='button';reset.textContent='還原全部品項';reset.onclick=()=>{good=originals.map(o=>({...o,lines:o.lines.map(l=>({...l}))}));renderEditor();prepare();};
      const note=document.createElement('small');note.textContent='僅調整本次圖片，不修改原訂單。';editor.append(total,reset,note);
    }
    async function prepare(){
      const run=++sequence;clear();
      const active=good.filter(o=>o.lines.length);
      if(!active.length){status.textContent=note||'請保留至少一個品項，才能產生圖片。';return;}
      status.textContent='正在準備圖片…';
      try {
        const single=orders.length===1||combine;
        const filename=safeName(active[0].name)+'_訂單明細.png';
        let blob, failures=[];
        if(single)blob=await image(active,season);
        else{
          const files=[];
          for(const [i,o] of active.entries()){
            if(run!==sequence)return;
            status.textContent='正在準備圖片 '+(i+1)+' / '+active.length+'…';
            try{files.push({name:safeName(o.name)+'_訂單_'+(i+1)+'.png',blob:await image([o],season)});}
            catch{failures.push(o.name);}
          }
          if(!files.length)throw Error('所有圖片均無法產生');
          blob=await zip(files);
          if(run===sequence)status.textContent=[note,files.length+' 張圖片',failures.length?'產圖失敗：'+failures.join('、'):''].filter(Boolean).join('；');
        }
        if(run!==sequence)return;
        url=URL.createObjectURL(blob);link.href=url;link.download=single?filename:'顧客訂單圖片.zip';link.textContent=single?'下載 PNG':'下載 ZIP';link.hidden=false;
        if(single){
          img.src=url;img.hidden=false;status.textContent=note;
          file=new File([blob],filename,{type:'image/png'});
          shareBtn.hidden=!(share&&navigator.canShare?.({files:[file]}));
        }
      }catch(e){if(run===sequence)status.textContent=[note,e.message].filter(Boolean).join('；');}
    }
    const knownSame=good.every(o=>nameKey(o.name)===nameKey(good[0]?.name));
    if(good.length>1&&!skipped.length&&knownSame){
      const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';
      label.append(check,' 確認為同一位顧客，合成一張圖片');dialog.querySelector('.order-image-controls').append(label);
      check.onchange=()=>{combine=check.checked;prepare();};
    }
    renderEditor();document.body.append(dialog);dialog.showModal();prepare();
  }
  function mount(root, entries, options, desktop=false){
    if(!entries.length)return;
    const bar=document.createElement('div');bar.className='order-export-actions';
    const button=(label,icon,action)=>{
      const b=document.createElement('button');b.type='button';
      const glyph=document.createElement('i');glyph.dataset.lucide=icon;glyph.setAttribute('aria-hidden','true');
      b.append(glyph,' '+label);b.onclick=action;return b;
    };
    const batch=button('下載所選圖片','images',()=>open(entries.filter(e=>!e.article.hidden&&e.check?.checked).map(e=>e.order),options));
    batch.disabled=!desktop;bar.append(batch);
    const dock=desktop?null:options.dock;
    const count=document.createElement('span'),spacer=document.createElement('div');
    const all=document.createElement('input');all.type='checkbox';
    const update=()=>{
      const size=entries.filter(x=>x.check?.checked).length;
      batch.disabled=!size;
      if(dock){
        bar.hidden=!size;spacer.hidden=!size;count.textContent='已選 '+size+' 筆';
        all.checked=size===entries.length;all.indeterminate=size>0&&size<entries.length;
      }
    };
    if(dock){
      bar.classList.add('order-export-dock');bar.hidden=true;
      count.setAttribute('aria-live','polite');
      const group=document.createElement('div');group.className='export-dock-selection';
      const label=document.createElement('label');label.append(all,'全選');
      group.append(count,label);bar.prepend(group);
      all.onchange=()=>{for(const e of entries)e.check.checked=all.checked;update();};
      spacer.className='order-export-spacer';spacer.hidden=true;
    }
    for(const e of entries){
      if(dock){
        e.check=document.createElement('input');e.check.type='checkbox';e.check.className='order-name-check';
        e.check.setAttribute('aria-label','選取 '+e.order.name);
        e.check.onchange=update;
        e.area.classList.add('order-name-selection');e.area.prepend(e.check);
        continue;
      }
      const actions=document.createElement('div');actions.className='order-export-actions';
      if(!desktop){
        const label=document.createElement('label');label.className='order-export-select';
        e.check=document.createElement('input');e.check.type='checkbox';e.check.setAttribute('aria-label','選取 '+e.order.name);
        e.check.onchange=()=>{
          const size=entries.filter(x=>x.check?.checked).length;
          batch.disabled=!size;
          if(dock){bar.hidden=!size;spacer.hidden=!size;count.textContent='已選 '+size+' 筆';}
        };
        label.append(e.check,'選取');actions.append(label);
      }
      actions.append(button('下載圖片','image-down',()=>open([e.order],options)));
      e.area.append(actions);
    }
    if(dock){dock.append(bar);root.append(spacer);}
    else root.prepend(bar);
  }
  globalThis.D77OrderImage={open,valid,zip,mount,removeExportLine,toggleExportShortage};
})();

