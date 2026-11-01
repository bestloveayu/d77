export function createPushClient(api,browser=globalThis,{isCurrent=()=>true}={}){
  const check=()=>{if(!isCurrent())throw Error('登入狀態已變更，請重新啟用通知');};
  const supported=()=>!!(browser.isSecureContext&&browser.Notification&&browser.PushManager&&browser.navigator?.serviceWorker);
  const registration=()=>browser.navigator.serviceWorker.getRegistration(new URL('./',import.meta.url).href);
  const serialized=sub=>typeof sub.toJSON==='function'?sub.toJSON():sub;
  const current=async()=>supported()?(await registration())?.pushManager.getSubscription():null;
  async function status(){
    if(!supported())return {available:false,subscribed:false,supported:false};
    const server=await api('/push/status'),sub=await current();
    const device=sub?await api('/push/device',{op:'status',subscription:serialized(sub)}):{subscribed:false};
    return {...server,...device,supported:true,permission:browser.Notification.permission};
  }
  async function enable(){
    if(!supported())throw Error('此瀏覽器不支援通知，請使用 Android Chrome 開啟');
    // This is called directly from the enable click, before any network await.
    const permission=await browser.Notification.requestPermission();
    check();
    if(permission!=='granted')throw Error('尚未允許通知，請到瀏覽器網站權限中調整');
    const server=await api('/push/status');check();if(!server.available)throw Error(server.health?.message||'推播服務尚未就緒');
    await browser.navigator.serviceWorker.register(new URL('./sw.js',import.meta.url),{scope:new URL('./',import.meta.url).href,updateViaCache:'none'});
    const reg=await browser.navigator.serviceWorker.ready;check();
    const old=await reg.pushManager.getSubscription();
    const raw=atob(server.publicKey.replace(/-/g,'+').replace(/_/g,'/'));
    const sub=old||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))});
    let registered=false;
    try{check();await api('/push/device',{op:'register',subscription:serialized(sub)});registered=true;check();}
    catch(e){if(registered)try{await api('/push/device',{op:'remove',subscription:serialized(sub)});}catch{}if(!old)await sub.unsubscribe();throw e;}
    return {subscribed:true};
  }
  async function disable(){
    const sub=await current();if(!sub)return;
    try{await api('/push/device',{op:'remove',subscription:serialized(sub)});}
    finally{await sub.unsubscribe();}
  }
  async function test(){const sub=await current();if(!sub)throw Error('請先啟用此裝置通知');await api('/push/device',{op:'test',subscription:serialized(sub)});}
  return {supported,status,enable,disable,test};
}

