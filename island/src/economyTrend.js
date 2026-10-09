// Settled game days only. This is a report of actual cash flows, not a forecast.
export function operatingTrend(state, windowDays=7){
 const size=Math.max(1,Math.min(60,Math.floor(Number(windowDays)||7)));
 const rows=(state.economy?.townDays||[]).filter(r=>r&&Number.isFinite(r.paid)&&Number.isFinite(r.day)&&Number.isFinite(r.income)&&Number.isFinite(r.cost)&&Number.isFinite(r.budget)&&Number.isFinite(r.visitorIncome)&&Number.isFinite(r.visitorCost)).slice(-size);
 const totals=rows.reduce((a,r)=>{
  const deferred=Math.max(0,r.budget-r.paid),fullCost=r.cost+deferred;
  const passiveNet=r.visitorIncome-r.visitorCost-r.budget;
  a.income+=r.income;a.fullCost+=fullCost;a.net+=r.income-fullCost;
  a.passiveNet+=passiveNet;a.passiveCost+=r.visitorCost+r.budget;a.deferred+=deferred;
  return a;
 },{income:0,fullCost:0,net:0,passiveNet:0,passiveCost:0,deferred:0});
 const count=rows.length,mean=n=>count?n/count:null;
 return {count,startDay:rows[0]?.day??null,endDay:rows.at(-1)?.day??null,
  dailyIncome:mean(totals.income),dailyFullCost:mean(totals.fullCost),dailyNet:mean(totals.net),
  dailyPassiveNet:mean(totals.passiveNet),dailyActiveNet:mean(totals.net-totals.passiveNet),
  dailyDeferred:mean(totals.deferred),
  fullCostMargin:totals.fullCost?totals.net/totals.fullCost:null,
  passiveCostMargin:totals.passiveCost?totals.passiveNet/totals.passiveCost:null};
}
