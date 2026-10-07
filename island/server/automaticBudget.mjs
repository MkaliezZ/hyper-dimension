import {runLedger} from './runLedger.mjs';
import {NPC_CADENCE} from '../src/npcCadence.js';
export const AUTO_INTERVALS=Object.freeze({plans:NPC_CADENCE.planSeconds,conversations:NPC_CADENCE.conversationSeconds,steward:NPC_CADENCE.stewardSeconds});
export function createAutomaticBudget(clock=Date.now){
 const records=Object.fromEntries(Object.keys(AUTO_INTERVALS).map(key=>[key,{nextAt:0,accepted:0,limited:0}]));
 function reserve(key){const row=records[key];if(!row)throw Error('Unknown automatic request type');const now=clock();
  if(now<row.nextAt){row.limited++;const e=Error('正在沿用当前生活安排，模型更新间隔尚未结束');e.code='automatic_cooldown';e.retryAfter=Math.ceil((row.nextAt-now)/1000);throw e;}
  row.nextAt=now+AUTO_INTERVALS[key]*1000;row.accepted++;
 }
 return {reserve,snapshot:()=>Object.fromEntries(Object.entries(records).map(([key,row])=>[key,{intervalSeconds:AUTO_INTERVALS[key],accepted:row.accepted,limited:row.limited,retryAfter:Math.max(0,Math.ceil((row.nextAt-clock())/1000))}]))};
}
const status=Object.fromEntries(Object.keys(AUTO_INTERVALS).map(key=>[key,{intervalSeconds:AUTO_INTERVALS[key],accepted:0,limited:0,retryAfter:0}]));
export const reserveAutomaticCall=async(key,metadata={})=>{
 try{const run=await runLedger.begin({...metadata,kind:key,automatic:true});status[key].accepted++;status[key].retryAfter=AUTO_INTERVALS[key];return run}
 catch(e){if(status[key]){status[key].limited++;status[key].retryAfter=e.retryAfter||0}throw e}
};
export const automaticBudgetStatus=()=>structuredClone(status);
