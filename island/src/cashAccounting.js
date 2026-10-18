// The recent-detail window is bounded independently from daily cash totals.
// Currency moves in resource transactions; this module only records that result.
const DETAIL_LIMIT=300,DAY_LIMIT=60;
const totalRows=rows=>{
 const total={income:0,cost:0,net:0,byCategory:[]};
 for(const row of rows){
  const name=typeof row.category==='string'?row.category:'legacy',net=row.income-row.cost;
  total.income+=row.income;total.cost+=row.cost;total.net+=net;
  let category=total.byCategory.find(c=>c.category===name);
  if(!category){category={category:name,income:0,cost:0,net:0};total.byCategory.push(category);}
  category.income+=row.income;category.cost+=row.cost;category.net+=net;
 }
 return total;
};
export function cashDayReport(state,day=state.day){
 const economy=state.economy||{},stored=economy.cashDays?.find(row=>row.day===day);
 if(stored)return structuredClone(stored);
 const ledger=economy.cashLedger||[],rows=ledger.filter(row=>row.day===day);
 // A full window consisting only of this day may have lost older entries.
 // Keep that legacy uncertainty explicit instead of inventing missing money.
 return {day,...totalRows(rows),complete:ledger.length<DETAIL_LIMIT||ledger[0]?.day<day};
}
export function cashDayTotals(state){
 const {income,cost,net}=cashDayReport(state);
 return {income,cost,net};
}
export function recordCashFlow(state,{income=0,cost=0,category='other',note='',escrowDelta}){
 if(!Number.isSafeInteger(income)||income<0||!Number.isSafeInteger(cost)||cost<0||typeof category!=='string'||escrowDelta!==undefined&&!Number.isSafeInteger(escrowDelta))throw TypeError('Invalid cash flow');
 const economy=state.economy??={},day=state.day;
 const book=cashDayReport(state,day),row={day,category,note,income,cost,net:income-cost,...(escrowDelta===undefined?{}:{escrowDelta})};
 const updated={income:book.income+income,cost:book.cost+cost,net:book.net+row.net,byCategory:book.byCategory};
 let group=updated.byCategory.find(c=>c.category===category);
 if(!group){group={category,income:0,cost:0,net:0};updated.byCategory.push(group);}
 group.income+=income;group.cost+=cost;group.net+=row.net;
 const days=(economy.cashDays||[]).filter(item=>item.day!==day);
 days.push({day,...updated,complete:book.complete});days.sort((a,b)=>a.day-b.day);
 economy.cashDays=days.slice(-DAY_LIMIT);
 economy.costs=(economy.costs||0)+cost;
 economy.cashLedger=[...(economy.cashLedger||[]),row].slice(-DETAIL_LIMIT);
 return row;
}
export function validCashDays(value){
 if(value===undefined)return true;
 if(!Array.isArray(value)||value.length>DAY_LIMIT)return false;
 let previous=0;
 return value.every(row=>{
  if(!row||!Number.isSafeInteger(row.day)||row.day<=previous||typeof row.complete!=='boolean'||!Array.isArray(row.byCategory))return false;
  previous=row.day;
  if(![row.income,row.cost].every(n=>Number.isFinite(n)&&n>=0)||row.net!==row.income-row.cost)return false;
  const names=new Set();let income=0,cost=0;
  for(const item of row.byCategory){
   if(!item||typeof item.category!=='string'||names.has(item.category)||![item.income,item.cost].every(n=>Number.isFinite(n)&&n>=0)||item.net!==item.income-item.cost)return false;
   names.add(item.category);income+=item.income;cost+=item.cost;
  }
  return income===row.income&&cost===row.cost;
 });
}
