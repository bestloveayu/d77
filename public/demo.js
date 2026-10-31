// Fictional, bundled examples only. Never generate this file from production data.
export function demoSnapshot(){
  const product=(name,stock,ordered,shipped,ready,cards=false,usedStock=0)=>({name,stock,ordered,shipped,outstanding:ordered-shipped,shortage:Math.max(0,ordered-shipped-stock),coverage:'confirmed',usedStock,rules:ready?[{name:'規則檔',url:'',cards:false},...(cards?[{name:'卡表',url:'',cards:true}]:[])]:[],customers:[]});
  const products=[product('企鵝之路',8,18,6,true,true),product('維新前夜',5,10,3,true),product('葡萄銃手',3,8,2,false),product('Sinabyss',4,6,3,false),product('北海',10,8,4,true,false,1),product('橡樹物語',5,5,2,true)];
  const line=(name,quantity,price,shipped,purchased,mailed)=>({name,originalName:name,quantity,price,shipped,purchased,mailed,mapped:true});
  const orders=[{id:'sample-1',name:'示範顧客甲',nickname:'虛構資料',phoneSuffix:'',time:'2026/11/01 上午 09:18',status:'已出貨',total:450,lines:[line('Sinabyss',1,100,1,1,0),line('葡萄銃手',1,150,1,1,0),line('企鵝之路',1,200,1,1,1)],issues:[]},
    {id:'sample-2',name:'示範顧客乙',nickname:'虛構資料',phoneSuffix:'',time:'2026/11/01 上午 08:50',status:'待出貨',total:300,lines:[line('維新前夜',1,150,0,1,0),line('葡萄銃手',1,150,0,1,0)],issues:[]},
    {id:'sample-3',name:'示範顧客丙',nickname:'虛構資料',phoneSuffix:'',time:'2026/10/31 下午 09:10',status:'狀態未確認',total:200,lines:[line('企鵝之路',1,200,null,null,null)],issues:[]}];
  for(const p of products)p.customers=orders.flatMap(o=>o.lines.filter(l=>l.name===p.name).map(l=>({id:o.id,name:o.name,mailed:l.mailed})));
  return {fictional:true,season:'2026秋',updatedAt:new Date().toISOString(),orders,products,summary:{orders:3,attention:2,shortages:3,unknownStock:1,rulesReady:4,rulesTotal:6},finance:{income:10000,cost:6000,profit:4000},issues:[],operations:[],sourceStatus:{catalog:'ok',responses:'ok',ledger:'ok',team:'ok',documents:'ok',rules:'ok'}};
}
export function demoEvents(){return [
  {id:'demo-1',type:'activity',title:'示範成員甲完成出貨登記',detail:'虛構示範事件，不代表真實操作',time:new Date().toISOString(),target:{page:'orders'},read:false},
  {id:'demo-2',type:'shortage',title:'企鵝之路待補貨 4 盒',detail:'依未出貨需求與帳面庫存計算',time:new Date(Date.now()-8*60000).toISOString(),target:{page:'inventory',name:'企鵝之路'},read:false},
  {id:'demo-3',type:'rules',title:'維新前夜中文規則已備齊',detail:'可查看訂購顧客的寄送狀態',time:new Date(Date.now()-30*60000).toISOString(),target:{page:'rules',name:'維新前夜'},read:true},
  {id:'demo-4',type:'order',title:'新增 2 筆預購訂單',detail:'資料已更新',time:new Date(Date.now()-50*60000).toISOString(),target:{page:'orders'},read:true}
];}
