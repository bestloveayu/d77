import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('widget has separate header, activity, compact counts and timestamp footer',()=>{
  const xml=read('res/layout/widget_board.xml');
  for(const id of ['season','header_line','feed','metrics_line','purchase_value','purchase_label','footer','view_all'])assert.ok(xml.includes('@+id/'+id),id);
  assert.ok(xml.indexOf('@+id/feed')<xml.indexOf('@+id/purchase_value'));
  assert.ok(xml.includes('@font/widget_serif'));
});
test('activity rows have aligned real icons, title, body and independent time',()=>{
  const xml=read('res/layout/widget_row.xml');
  for(const id of ['row_icon','row_title','row_body','row_time','row_line'])assert.ok(xml.includes('@+id/'+id),id);
  assert.ok(!xml.includes('android:layout_height="26dp"'));
});
test('both modes preserve wave decoration and use no emoji controls',()=>{
  for(const file of ['widget_background.xml','widget_background_dark.xml'])assert.ok(read('res/drawable/'+file).includes('wave'));
  const xml=read('res/layout/widget_board.xml');assert.ok(!xml.includes('⚙'));assert.ok(!xml.includes('↻'));
});

test('all sizes use a scrolling feed without hiding detail or estimating row limits',()=>{
  assert.match(read('res/layout/widget_board.xml'),/<ListView[^>]+id="@\+id\/feed"/);
  const source=read('src/tw/d77/widget/BoardWidget.java');
  assert.ok(!source.includes('LayoutMetrics.rows('));
  assert.ok(source.includes('setRemoteAdapter'));
  const service=read('src/tw/d77/widget/FeedService.java');
  assert.ok(!service.includes('View.GONE'));
  assert.ok(service.includes('setOnClickFillInIntent'));
  assert.match(read('AndroidManifest.xml'),/BIND_REMOTEVIEWS/);
});
