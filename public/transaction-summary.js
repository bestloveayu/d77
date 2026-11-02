const validPerson=person=>['east','yu'].includes(person);
export function personCash(row,person='all'){
  if(!validPerson(person))return {income:row.income,cost:row.cost};
  return row.cashByPerson?.[person]||(row.income===0&&row.cost===0?{income:0,cost:0}:{income:null,cost:null});
}
export function filterTransactions(rows,{search='',type='all',person='all'}={}){
  const query=search.trim().toLowerCase();
  return rows.filter(row=>{
    if(type!=='all'&&row.kind!==type)return false;
    if(![row.name,row.subject,row.note,row.actor,row.transactionId].join(' ').toLowerCase().includes(query))return false;
    if(!validPerson(person))return true;
    if(row.kind==='結算'&&typeof row.settlement==='number'&&row.settlement!==0)return true;
    const own=row.cashByPerson?.[person];
    if(own)return own.income==null||own.cost==null||own.income!==0||own.cost!==0;
    return String(row.actor||'').includes(person==='east'?'小東':'于正');
  });
}
export function transactionTotals(rows,person='all'){
  let income=0,cost=0;
  for(const row of rows){const own=personCash(row,person);income=income===null||!Number.isFinite(own.income)?null:income+own.income;cost=cost===null||!Number.isFinite(own.cost)?null:cost+own.cost;}
  return {income,cost,profit:income===null||cost===null?null:income-cost,count:rows.length};
}
export function transactionAmount(row,person='all'){
  if(!validPerson(person)||row.kind==='結算')return row.amount;
  const own=personCash(row,person);
  return ['銷貨收入','其他收入'].includes(row.kind)?own.income:['進貨成本','其他成本'].includes(row.kind)?own.cost:null;
}
