const pages=['overview','orders','inventory','rules','notifications'];
export function swipePage(current,dx,dy,duration){
  const index=pages.indexOf(current);
  if(index<0||Math.abs(dx)<75||Math.abs(dx)<Math.abs(dy)*1.7||duration>900)return null;
  return pages[(index+(dx<0?1:-1)+pages.length)%pages.length];
}
export const dragOffset=(dx,width)=>Math.max(-width,Math.min(width,dx));
export function installSwipe(root,{current,enabled,navigate,preview,decorate=()=>{}}){
  let start=null,animating=false,stage=null,surface=null,outgoing=null,incoming=null,nextPage=null,width=0,offset=0,visibility='',committing=false;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const neighbor=dx=>pages[(pages.indexOf(current())+(dx<0?1:-1)+pages.length)%pages.length];
  function cleanup(){
    stage?.getAnimations({subtree:true}).forEach(a=>a.cancel());stage?.remove();stage=null;
    if(surface)surface.style.visibility=visibility;
    surface=outgoing=incoming=null;start=null;animating=false;committing=false;nextPage=null;offset=0;
  }
  function createStage(dx){
    surface=root.querySelector('#view')||root;const rect=surface.getBoundingClientRect();width=rect.width;
    if(width<=0)return false;
    visibility=surface.style.visibility;
    stage=document.createElement('div');stage.className='swipe-stage';stage.setAttribute('aria-hidden','true');stage.inert=true;
    const top=Math.max(0,rect.top),nav=document.querySelector('#nav')?.getBoundingClientRect();
    Object.assign(stage.style,{left:rect.left+'px',top:top+'px',width:width+'px',height:Math.max(1,(nav?.top||innerHeight)-top)+'px'});
    outgoing=document.createElement('div');outgoing.className='swipe-outgoing';
    const copy=surface.cloneNode(true);copy.removeAttribute('id');copy.style.marginTop=Math.min(0,rect.top)+'px';outgoing.append(copy);
    incoming=document.createElement('div');incoming.className='swipe-incoming';stage.append(outgoing,incoming);
    surface.style.visibility='hidden';document.body.append(stage);draw(dx);return true;
  }
  function draw(dx){
    offset=dragOffset(dx,width);const next=neighbor(dx);
    if(nextPage!==next){
      nextPage=next;incoming.setAttribute('data-page',next);
      incoming.innerHTML=preview?preview(next):'';
      stage.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
      decorate();
    }
    outgoing.style.transform=`translate3d(${offset}px,0,0)`;
    incoming.style.transform=`translate3d(${offset+(dx<0?width:-width)}px,0,0)`;
  }
  async function settle(commit){
    if(!stage){if(commit)navigate(nextPage);start=null;return;}
    animating=true;const activeStage=stage,target=commit?(offset<0?-width:width):0;
    const sign=offset<0?1:-1;const destination=nextPage;
    try{
      const duration=reduced()?0:Math.max(120,Math.min(240,Math.abs(target-offset)/width*260));
      await Promise.all([
        outgoing.animate([{transform:`translate3d(${offset}px,0,0)`},{transform:`translate3d(${target}px,0,0)`}],{duration,easing:'cubic-bezier(.22,.8,.25,1)',fill:'forwards'}).finished,
        incoming.animate([{transform:`translate3d(${offset+sign*width}px,0,0)`},{transform:`translate3d(${target+sign*width}px,0,0)`}],{duration,easing:'cubic-bezier(.22,.8,.25,1)',fill:'forwards'}).finished
      ]);
      if(stage!==activeStage)return;
      if(commit){committing=true;navigate(destination);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}
    }catch{/* A resize, cancelled touch or external navigation can interrupt the transition. */}
    finally{if(stage===activeStage)cleanup();}
  }
  const blocked=target=>{
    if(!(target instanceof Element)||target.closest('input,textarea,select,button,a,[contenteditable=true],dialog'))return true;
    for(let el=target;el&&el!==root;el=el.parentElement){
      if(el.scrollWidth>el.clientWidth+1&&/auto|scroll/.test(getComputedStyle(el).overflowX))return true;
    }
    return false;
  };
  root.addEventListener('touchstart',event=>{
    if(animating||!enabled()||innerWidth>820||document.querySelector('dialog[open]')||event.touches.length!==1||blocked(event.target))return;
    cleanup();
    const t=event.touches[0];
    if(t.clientX<24||t.clientX>innerWidth-24)return;
    start={x:t.clientX,y:t.clientY,time:performance.now(),page:current(),locked:false};
  },{passive:true});
  root.addEventListener('touchmove',event=>{
    if(!start||animating)return;
    if(event.touches.length!==1||!enabled()||document.querySelector('dialog[open]')||current()!==start.page){cleanup();return;}
    const t=event.touches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;
    if(!start.locked){
      if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){cleanup();return;}
      if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.7)return;
      start.locked=true;
    }
    if(event.cancelable)event.preventDefault();
    if(!reduced()){if(!stage)createStage(dx);else draw(dx);}
  },{passive:false});
  root.addEventListener('touchcancel',()=>{if(stage)void settle(false);else cleanup();},{passive:true});
  root.addEventListener('touchend',event=>{
    const from=start;if(animating)return;
    if(!from||!enabled()||document.querySelector('dialog[open]')||event.changedTouches.length!==1||current()!==from.page){cleanup();return;}
    const to=event.changedTouches[0],dx=to.clientX-from.x,dy=to.clientY-from.y;
    const commit=from.locked?Math.abs(dx)>=Math.min(100,innerWidth*.23):!!swipePage(current(),dx,dy,performance.now()-from.time);
    if(!stage){nextPage=neighbor(dx);if(commit&&!reduced())createStage(dx);}
    else draw(dx);
    if(stage)void settle(commit);else{if(commit)navigate(nextPage);cleanup();}
  },{passive:true});
  window.addEventListener('resize',cleanup);
  window.addEventListener('hashchange',()=>{if(!committing)cleanup();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cleanup();});
}

