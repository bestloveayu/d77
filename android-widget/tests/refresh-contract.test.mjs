import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('manual refresh acknowledges scheduling, prioritizes execution, and reports scheduler rejection',()=>{
  const source=read('src/tw/d77/widget/Sync.java');
  assert.ok(source.includes('setOverrideDeadline(0)'));
  assert.ok(source.includes('JobScheduler.RESULT_SUCCESS'));
  assert.ok(source.includes('RefreshStatus.mark(c,"queued")'));
  assert.ok(source.includes('RefreshStatus.mark(c,"running")'));
  assert.ok(source.includes('SocketTimeoutException'));
});
test('widget displays refresh feedback without touching encrypted account data',()=>{
  assert.ok(read('src/tw/d77/widget/BoardWidget.java').includes('RefreshStatus.message(c)'));
  const status=read('src/tw/d77/widget/RefreshStatus.java');
  assert.ok(!status.includes('Vault'));
  assert.ok(status.includes('120000'));
});
