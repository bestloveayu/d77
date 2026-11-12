self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let message;try{message=event.data?.json();}catch{}
  const clean=(v,max)=>typeof v==='string'?v.slice(0,max):'';
  const page=['orders','inventory','rules'].includes(message?.page)?message.page:'overview';
  event.waitUntil(self.registration.showNotification(clean(message?.title,100)||'東77 雲端管理',{
    body:clean(message?.body,240)||'有新的雲端動態，請登入查看。',tag:'d77-cloud-update',renotify:true,
    icon:new URL('./assets/icon.svg',self.registration.scope).href,
    data:{page}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const page=['orders','inventory','rules'].includes(event.notification.data?.page)?event.notification.data.page:'overview';
  const url=new URL('./#'+page,self.registration.scope).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client=windows.find(w=>w.url.startsWith(self.registration.scope));
    if(client){await client.navigate(url);return client.focus();}
    return self.clients.openWindow(url);
  })());
});

