export function mountWidgetSettings({form,api,isCurrent,demo}){
  const section=document.createElement('section');section.className='setting-section';
  section.innerHTML='<h3>Android 桌面小工具</h3><p><a href="./downloads/d77-widget-0.1.0-test.apk" download>下載 Android 測試版 APK</a></p><div class="section-actions"><button type="button" data-widget-pair>產生裝置配對碼</button><button type="button" data-widget-revoke>撤銷所有小工具裝置</button></div><div data-widget-status role="status" aria-live="polite"></div>';
  form.before(section);
  const status=section.querySelector('[data-widget-status]');let busy=false,expiryTimer;
  const action=async kind=>{
    if(busy||!isCurrent())return;
    if(demo){status.textContent='示範模式不提供裝置授權';return;}
    const prompt=kind==='pair'?'允許持有此配對碼的 Android 裝置唯讀查看待辦數字與匿名動態，期限 30 天？配對碼有效 5 分鐘，請勿分享給他人。':'撤銷此帳號所有 Android 小工具裝置？網頁登入與瀏覽器通知不受影響。';
    if(!window.confirm(prompt))return;
    busy=true;section.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='處理中…';
    try{
      const result=await api('/widget/'+kind,{});if(!isCurrent()||!section.isConnected)return;
      clearTimeout(expiryTimer);status.replaceChildren();
      if(kind==='pair'){
        const label=document.createElement('p');label.textContent='一次性配對碼 · 5 分鐘內有效';
        const code=document.createElement('code');code.textContent=result.code;code.style.cssText='display:block;overflow-wrap:anywhere;user-select:all;padding:12px 0';
        const copy=document.createElement('button');copy.type='button';copy.textContent='複製配對碼';
        copy.onclick=async()=>{try{await navigator.clipboard.writeText(result.code);copy.textContent='已複製';}catch{copy.textContent='請長按配對碼選取';}};
        status.append(label,code,copy);
        expiryTimer=setTimeout(()=>{if(status.isConnected)status.textContent='配對碼已到期，請重新產生';},Math.max(0,result.expiresAt-Date.now()));
      }else status.textContent='已撤銷所有小工具裝置';
    }catch(e){if(isCurrent()&&section.isConnected)status.textContent=e.message;}
    finally{busy=false;section.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
  section.querySelector('[data-widget-pair]').onclick=()=>action('pair');
  section.querySelector('[data-widget-revoke]').onclick=()=>action('revoke');
}
