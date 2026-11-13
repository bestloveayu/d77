import {itemFacts} from './widget-facts.mjs';
// Read-time projection only: persisted event IDs, timestamps and delivery claims stay intact.
export function displayEvent(event,snapshot){
  const out={...event};
  if(event.type==='shortage')out.title='庫存不足';
  if(event.type==='rules')out.title='中文規則更新';
  if(['order','change','purchase','shipment','mail','rules-pending'].includes(event.type)){
    const order=snapshot?.orders?.find(o=>o.id===event.target?.id);
    const suffix={order:'新增預購',change:'訂購內容有異動',purchase:'下單已確認',shipment:'出貨已登記',mail:'規則已寄送','rules-pending':'規則待寄'};
    const oldTitle=event.widgetFacts?.title||event.title||'';
    const oldName=oldTitle.match(/^(.*?)\s*(?:·\s*)?(?:新增訂單|新增預購(?:訂單)?|訂單異動|訂購內容有異動|下單已確認|出貨已登記|規則已寄送|待寄規則|規則待寄)$/)?.[1]?.trim();
    const name=order?.name||oldName||'姓名待核對';
    out.title=name+' '+suffix[event.type];
    if(['order','change','purchase'].includes(event.type))out.detail=order?itemFacts(order):event.widgetFacts?.body||event.detail||'此筆舊紀錄未保存品項明細';
    if(event.type==='shipment'&&!/(?:小東|于正)登記/.test(event.detail||''))out.detail='登記人待確認';
    if(event.type==='mail'&&!/(?:小東|于正)寄送/.test(event.detail||''))out.detail='寄送人待確認';
  }
  return out;
}

