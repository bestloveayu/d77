self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  event.waitUntil(self.registration.showNotification('東77 雲端管理',{
    body:'有新的雲端動態，請登入查看。',tag:'d77-cloud-update',
    icon:new URL('./assets/icon.svg',self.registration.scope).href,
    data:{url:new URL('./#overview',self.registration.scope).href}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=new URL('./#overview',self.registration.scope).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client=windows.find(w=>w.url.startsWith(self.registration.scope));
    if(client){await client.navigate(url);return client.focus();}
    return self.clients.openWindow(url);
  })());
});
