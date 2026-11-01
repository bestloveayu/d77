const pages=['overview','orders','inventory','rules','notifications'];
export function swipePage(current,dx,dy,duration){
  const index=pages.indexOf(current);
  if(index<0||Math.abs(dx)<75||Math.abs(dx)<Math.abs(dy)*1.7||duration>900)return null;
  return pages[(index+(dx<0?1:-1)+pages.length)%pages.length];
}
export function installSwipe(root,{current,enabled,navigate}){
  let start=null,animating=false;
  async function changePage(next,dx){
    const surface=root.querySelector('#view')||root;
    if(typeof surface.animate!=='function'||matchMedia('(prefers-reduced-motion: reduce)').matches){navigate(next);return;}
    animating=true;
    const overflow=root.style.overflowX;root.style.overflowX='clip';
    const direction=dx<0?-1:1;
    try{
      await surface.animate([{transform:'translateX(0)',opacity:1},{transform:`translateX(${direction*45}px)`,opacity:0}],{duration:130,easing:'ease-in'}).finished;
      navigate(next);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      await surface.animate([{transform:`translateX(${-direction*45}px)`,opacity:0},{transform:'translateX(0)',opacity:1}],{duration:190,easing:'ease-out'}).finished;
    }finally{root.style.overflowX=overflow;animating=false;}
  }
  const blocked=target=>{
    if(!(target instanceof Element)||target.closest('input,textarea,select,button,a,[contenteditable=true],dialog'))return true;
    for(let el=target;el&&el!==root;el=el.parentElement){
      if(el.scrollWidth>el.clientWidth+1&&/auto|scroll/.test(getComputedStyle(el).overflowX))return true;
    }
    return false;
  };
  root.addEventListener('touchstart',event=>{
    start=null;
    if(animating||!enabled()||innerWidth>820||document.querySelector('dialog[open]')||event.touches.length!==1||blocked(event.target))return;
    const t=event.touches[0];
    if(t.clientX<24||t.clientX>innerWidth-24)return;
    start={x:t.clientX,y:t.clientY,time:performance.now()};
  },{passive:true});
  root.addEventListener('touchmove',event=>{if(event.touches.length!==1)start=null;},{passive:true});
  root.addEventListener('touchcancel',()=>{start=null;},{passive:true});
  root.addEventListener('touchend',event=>{
    const from=start;start=null;
    if(!from||!enabled()||document.querySelector('dialog[open]')||event.changedTouches.length!==1)return;
    const to=event.changedTouches[0];const next=swipePage(current(),to.clientX-from.x,to.clientY-from.y,performance.now()-from.time);
    if(next)void changePage(next,to.clientX-from.x);
  },{passive:true});
}

