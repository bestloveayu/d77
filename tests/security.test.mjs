import test from 'node:test';import assert from 'node:assert/strict';
import worker,{BoardStore} from '../worker/index.mjs';
test('API denies anonymous, wrong origin, unknown paths',async()=>{
  const env={ALLOWED_ORIGIN:'https://bestloveayu.github.io',GOOGLE_CLIENT_ID:'test',ALLOWED_EMAILS:''};
  assert.equal((await worker.fetch(new Request('https://api/snapshot'),env)).status,401);
  assert.equal((await worker.fetch(new Request('https://api/snapshot',{headers:{Origin:'https://evil.test'}}),env)).status,403);
  assert.equal((await worker.fetch(new Request('https://api/orders/delete'),env)).status,404);
  assert.equal((await worker.fetch(new Request('https://api/snapshot',{headers:{Authorization:'Bearer garbage'}}),env)).status,401);
});
function fixture(){const values=new Map();const storage={get:async k=>values.get(k),put:async(k,v)=>values.set(k,v),delete:async k=>values.delete(k),transaction:async fn=>fn(storage)};return {values,board:new BoardStore({storage},{})};}
test('read receipts independent by account; no access without trusted internal identity',async()=>{
  const {values,board}=fixture();values.set('event-index',['one']);values.set('event:one',{id:'one',title:'test'});
  const request=(path,user,body)=>new Request('https://internal'+path,{method:body?'POST':'GET',headers:{'X-User':user,'X-Email':user+'@gmail.com'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await board.fetch(new Request('https://internal/notifications'))).status,401);
  await board.fetch(request('/read','yu',{ids:['one']}));
  assert.equal((await(await board.fetch(request('/notifications','yu'))).json()).events[0].read,true);
  assert.equal((await(await board.fetch(request('/notifications','dong'))).json()).events[0].read,false);
  assert.equal((await board.fetch(request('/read','yu',{ids:['fake']}))).status,400);
});
test('bad notification settings rejected; no push until opt-in',async()=>{
  const {board}=fixture();const req=body=>new Request('https://internal/preferences',{method:'POST',headers:{'X-User':'one','X-Email':'one@gmail.com'},body:JSON.stringify(body)});
  assert.equal((await board.fetch(req({pushEnabled:true}))).status,400);
  assert.equal((await board.fetch(req({pushEnabled:false,quiet:true,quietStart:22,quietEnd:8,types:['order']}))).status,200);
});
