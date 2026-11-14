// Merge only paired sources for one order at one exact observation time.
export function dedupeEvents(events=[]){
 const groups=new Map(),output=[];
 for(const event of events){
   if(!['purchase','registration'].includes(event.type)||!event.target?.id||!event.time){output.push(event);continue;}
   const body=event.activityFacts?.body||event.widgetFacts?.body||event.detail||'';
   const key=JSON.stringify([event.target.id,event.time,body.replace(/\s+/g,'')]);
   const previous=groups.get(key);
   if(!previous){const entry={...event,relatedEventIds:[event.id]};groups.set(key,entry);output.push(entry);continue;}
   if(previous.type===event.type){output.push(event);continue;}
   previous.relatedEventIds.push(event.id);
   if(event.type==='registration'){
     const ids=previous.relatedEventIds;Object.assign(previous,event);previous.relatedEventIds=ids;
   }
 }
 return output;
}
