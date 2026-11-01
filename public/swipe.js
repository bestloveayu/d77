const pages=['overview','orders','inventory','rules','notifications'];
export function swipePage(current,dx,dy,duration){
  const index=pages.indexOf(current);
  if(index<0||Math.abs(dx)<75||Math.abs(dx)<Math.abs(dy)*1.7||duration>900)return null;
  return pages[(index+(dx<0?1:-1)+pages.length)%pages.length];
}
export function installSwipe(root,{current,enabled,navigate}){
  let start=null;
  const blocked=target=>{
    if(!(target instanceof Element)||target.closest('input,textarea,select,button,a,[contenteditable=true],dialog'))return true;
    for(let el=target;el&&el!==root;el=el.parentElement){
      if(el.scrollWidth>el.clientWidth+1&&/auto|scroll/.test(getComputedStyle(el).overflowX))return true;
    }
    return false;
  };
  root.addEventListener('touchstart',event=>{
    start=null;
    if(!enabled()||innerWidth>820||document.querySelector('dialog[open]')||event.touches.length!==1||blocked(event.target))return;
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
    if(next)navigate(next);
  },{passive:true});
}

