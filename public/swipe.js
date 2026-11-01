const pages=['overview','orders','inventory','rules','notifications'];
export function swipePage(current,dx,dy,duration){
  const index=pages.indexOf(current);
  if(index<0||Math.abs(dx)<75||Math.abs(dx)<Math.abs(dy)*1.7||duration>900)return null;
  return pages[(index+(dx<0?1:-1)+pages.length)%pages.length];
}
export const dragOffset=(dx,width)=>Math.max(-width,Math.min(width,dx));
export const commitDrag=(dx,velocity,width)=>Math.abs(dx)>=Math.min(100,width*.25)||(Math.abs(dx)>=20&&Math.abs(velocity)>=.45&&Math.sign(dx)===Math.sign(velocity));
export function installSwipe(root,{current,enabled,navigate,preview,decorate=()=>{}}){
  let start=null,animating=false,stage=null,surface=null,outgoing=null,incoming=null,nextPage=null,width=0,offset=0,originalStyle=null,overflow='',committing=false;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const neighbor=dx=>pages[(pages.indexOf(current())+(dx<0?1:-1)+pages.length)%pages.length];
  function cleanup(){
    outgoing?.getAnimations().forEach(a=>a.cancel());
    stage?.getAnimations({subtree:true}).forEach(a=>a.cancel());stage?.remove();stage=null;
    if(surface){surface.classList.remove('swipe-outgoing');Object.assign(surface.style,originalStyle);root.style.overflowX=overflow;}
    surface=outgoing=incoming=null;start=null;animating=false;committing=false;nextPage=null;offset=0;
  }
  function createStage(dx){
    surface=root.querySelector('#view')||root;const rect=surface.getBoundingClientRect();width=rect.width;
    if(width<=0)return false;
    originalStyle={transform:surface.style.transform,willChange:surface.style.willChange};overflow=root.style.overflowX;root.style.overflowX='clip';
    stage=document.createElement('div');stage.className='swipe-stage';stage.setAttribute('aria-hidden','true');stage.inert=true;
    const top=Math.max(0,rect.top),nav=document.querySelector('#nav')?.getBoundingClientRect();
    Object.assign(stage.style,{left:rect.left+'px',top:top+'px',width:width+'px',height:Math.max(1,(nav?.top||innerHeight)-top)+'px'});
    // Move the live page instead of cloning a potentially large order list on first drag.
    outgoing=surface;outgoing.classList.add('swipe-outgoing');outgoing.style.willChange='transform';
    incoming=document.createElement('div');incoming.className='swipe-incoming';stage.append(incoming);
    document.body.append(stage);draw(dx);return true;
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
  async function settle(commit,velocity=0){
    if(!stage){if(commit)navigate(nextPage);start=null;return;}
    animating=true;const activeStage=stage,target=commit?(offset<0?-width:width):0;
    const sign=offset<0?1:-1;const destination=nextPage;
    try{
      const distance=Math.abs(target-offset);
      const duration=reduced()?0:Math.max(160,Math.min(300,distance/(Math.max(.55,Math.abs(velocity)))*.8));
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
    if(animating)return;
    cleanup();
    if(!enabled()||innerWidth>820||document.querySelector('dialog[open]')||event.touches.length!==1||blocked(event.target))return;
    const t=event.touches[0];
    if(t.clientX<24||t.clientX>innerWidth-24)return;
    start={x:t.clientX,y:t.clientY,time:performance.now(),page:current(),locked:false,samples:[{x:t.clientX,time:performance.now()}]};
  },{passive:true});
  root.addEventListener('touchmove',event=>{
    if(!start||animating)return;
    if(event.touches.length!==1||!enabled()||document.querySelector('dialog[open]')||current()!==start.page){cleanup();return;}
    const t=event.touches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;
    const now=performance.now();start.samples.push({x:t.clientX,time:now});start.samples=start.samples.filter(s=>now-s.time<=100).slice(-6);
    if(!start.locked){
      if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){cleanup();return;}
      if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.7)return;
      start.locked=true;
    }
    if(event.cancelable)event.preventDefault();
    if(!reduced()){if(!stage)createStage(dx);else draw(dx);}
  },{passive:false});
  root.addEventListener('touchcancel',()=>{if(animating)cleanup();else if(stage)void settle(false);else cleanup();},{passive:true});
  root.addEventListener('touchend',event=>{
    const from=start;if(animating)return;
    if(!from||!enabled()||document.querySelector('dialog[open]')||event.changedTouches.length!==1||current()!==from.page){cleanup();return;}
    const to=event.changedTouches[0],dx=to.clientX-from.x,dy=to.clientY-from.y;
    const now=performance.now(),sample=from.samples.find(s=>now-s.time<=100);
    const velocity=sample?(to.clientX-sample.x)/Math.max(16,now-sample.time):0;
    const commit=from.locked?commitDrag(dx,velocity,innerWidth):!!swipePage(current(),dx,dy,now-from.time);
    if(!stage){nextPage=neighbor(dx);if(commit&&!reduced())createStage(dx);}
    else draw(dx);
    if(stage)void settle(commit,velocity);else{if(commit)navigate(nextPage);cleanup();}
  },{passive:true});
  window.addEventListener('resize',cleanup);
  window.addEventListener('hashchange',()=>{if(!committing)cleanup();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cleanup();});
}

