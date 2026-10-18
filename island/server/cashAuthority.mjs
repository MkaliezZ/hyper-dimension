import {sameState} from '../src/actionMerge.js';
const protectedKeys=['costs','cashLedger','cashReceipts','cashDays'];
const snapshot=state=>Object.fromEntries(protectedKeys.map(key=>[key,state.economy?.[key]??(key==='costs'?0:key==='cashReceipts'?{}:[])]));
export function assertCashJournal(state,previous,actions){
 if(!(actions?.resources||actions?.personal||actions?.commerce))return;
 if(!sameState(snapshot(state),snapshot(previous)))throw Object.assign(Error('收支明细、累计支出与每日汇总由服务端结算，请读取已确认进度。'),{status:409,code:'economy_journal_conflict'});
}
