import {cashDayReport} from './cashAccounting.js';
import {projectedDayAccounts} from './economy.js';
const money=value=>Number.isFinite(value)?(value>0?'+':'')+new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(value):'—';
export function cashReportHTML(state){
 const report=cashDayReport(state),accounts=projectedDayAccounts(state);
 if(!report.complete)return '<section class="budget-card" data-cash-coverage="partial"><b>今日旧账尚有缺口</b><p>上方今日金额只包含已保留的明细，不能当作完整日账。后续交易继续记录，下一游戏日开始完整汇总；现有余额和物品保持原记录。</p></section>';
 const capital=report.byCategory.find(row=>row.category==='upgrade')?.cost||0;
 return '<section class="budget-card" data-cash-coverage="complete"><b>今日经营与建设</b><div class="business-stats"><span>日常结余（含待付岛务）<b data-cash-routine>'+money(accounts.projectedNet+capital)+'</b></span><span>建筑升级投入<b data-cash-capital>'+money(-capital)+'</b></span></div><p>日常结余已计入接待、订单、活动、补给、招聘、维护及岛务。建筑升级单独列出，也已计入上方支出和现金结余。</p></section>';
}
