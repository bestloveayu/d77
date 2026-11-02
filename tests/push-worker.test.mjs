import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
function fixture(windows=[]){const handlers={},shown=[],opened=[];const self={registration:{scope:'https://bestloveayu.github.io/d77/',showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>windows,openWindow:async url=>opened.push(url),claim:async()=>{}},skipWaiting(){},addEventListener(type,handler){handlers[type]=handler;}};vm.runInNewContext(source,{self,URL});return {handlers,shown,opened};}
test('push always shows fixed generic text, not payload business data',async()=>{
 const f=fixture();let done;f.handlers.push({data:{text:()=> 'private customer and amount'},waitUntil:p=>done=p});await done;
 assert.equal(f.shown[0][0],'東77 雲端管理');assert.equal(f.shown[0][1].body,'有新的雲端動態，請登入查看。');
 assert.equal(f.shown[0][1].data.url,'https://bestloveayu.github.io/d77/#overview');
});
test('notification click opens the fixed sign-in-protected latest activity overview',async()=>{
 const f=fixture();let done,closed=false;f.handlers.notificationclick({notification:{data:{url:'https://evil.test'},close(){closed=true;}},waitUntil:p=>done=p});await done;
 assert(closed);assert.deepEqual(f.opened,['https://bestloveayu.github.io/d77/#overview']);
 let navigated='',focused=false;const g=fixture([{url:'https://bestloveayu.github.io/d77/#orders',navigate:async url=>navigated=url,focus:async()=>focused=true}]);
 g.handlers.notificationclick({notification:{close(){}},waitUntil:p=>done=p});await done;assert.equal(navigated,'https://bestloveayu.github.io/d77/#overview');assert(focused);assert.equal(g.opened.length,0);
});
