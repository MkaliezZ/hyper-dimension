import {residentLifeClock} from './residentLife.js';
import {ITEM_BY_ID} from './contentCatalog.js';
export const SOCIAL_TOPIC_COOLDOWN=2700;
export const SOCIAL_TOPIC_KEYS=new Set(['work-approach']);
const traits=p=>({careful:/细心|谨慎|审慎|务实|坚持|倔强/.test(p?.personality||''),exploratory:/大胆|好奇|自由|创意|新鲜/.test(p?.personality||'')});
function completedWork(s,id){
 return Object.entries(s.taskActionReceipts||{}).reverse().find(([,r])=>r.npcId===id&&r.day>=s.day-1&&r.day<=s.day&&typeof r.result==='string'&&r.result.length&&Object.entries(r.delta||{}).some(([item,n])=>ITEM_BY_ID[item]&&n>0));
}
// A difference is a present conversation topic, never an invented grievance or missed promise.
export function workApproachTopic(s,a,b,pa,pb){
 if(a===b||![a,b].every(i=>Number.isInteger(i)&&i>=0&&i<15))return null;
 if(!(s.npcRelations?.[a]?.[b]?.interactions>0&&s.npcRelations?.[b]?.[a]?.interactions>0))return null;
 const now=residentLifeClock(s);
 if(s.residentLife?.topics?.some(t=>t.key==='work-approach'&&t.people.includes(a)&&t.people.includes(b)&&now<t.until))return null;
 const at=traits(pa),bt=traits(pb),careful=at.careful&&!at.exploratory&&bt.exploratory&&!bt.careful?a:bt.careful&&!bt.exploratory&&at.exploratory&&!at.careful?b:null;
 if(careful===null||!(pa.interest||[]).some(x=>(pb.interest||[]).includes(x)))return null;
 const wa=completedWork(s,a),wb=completedWork(s,b);if(!wa||!wb)return null;
 const facts=[[a,wa],[b,wb]].map(([id,[receiptId,r]])=>({id,receiptId,day:r.day,result:r.result.slice(0,70)}));
 return {key:'work-approach',careful,exploratory:careful===a?b:a,facts,reason:'各自完成工作后，讨论先核对细节还是先试新方案：'+facts.map(f=>(f.id===a?pa.name:pb.name)+'做了'+f.result.slice(0,22)).join('；')};
}
export function hasRecordedDifference(s,a,b){
 return (s.npcConversations||[]).some(r=>r.participants?.includes(a)&&r.participants?.includes(b)&&(r.type==='dispute'||r.type==='reconcile'&&r.changes?.some(c=>c.tension>0)))||
 (s.residentStories?.episodes||[]).some(e=>e.kind==='conflict'&&e.people.includes(a)&&e.people.includes(b)&&['scheduled','meeting','working'].includes(e.status));
}
