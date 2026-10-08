// Personal routines and social boundaries use completed actions, never invented memories.
import {BUILDINGS} from './world.js';
const rows=[
 [['seed-notes',7,'arrange','整理种苗观察笔记'],['garden-walk',14,'observe','观察温室叶片与新芽'],['quiet-camp',22,'rest','在营地歇一会儿']],
 [['wood-study',24,'observe','欣赏木作与配色'],['harbor-watch',23,'observe','看看船坞的修复工艺'],['fireside',19,'rest','在壁炉边放松']],
 [['rehearsal-watch',21,'observe','观看舞台排练'],['music-listen',12,'observe','听一段音乐'],['market-stroll',9,'observe','逛逛集市摊位']],
 [['sky-watch',5,'observe','观察天空与云层'],['star-reading',7,'arrange','翻阅星空记录'],['seaside-rest',22,'rest','在营地安静休息']],
 [['flower-colors',3,'observe','欣赏花束的颜色'],['garden-sketch',24,'paint','练习花草速写'],['plant-watch',14,'observe','看看温室的新叶']],
 [['harbor-study',23,'observe','看看船体与木料接合'],['beacon-watch',8,'observe','眺望航标与海面'],['camp-rest',22,'rest','在营地伸展休息']],
 [['recipe-reading',7,'arrange','翻阅烘焙笔记'],['bakery-watch',17,'observe','看看烘焙屋的陈列'],['song-break',12,'observe','听音乐换换心情']],
 [['photo-study',13,'observe','欣赏照片的构图'],['exhibit-study',18,'observe','看看展品与光影'],['sky-light',5,'observe','观察天光变化']],
 [['aquarium-watch',6,'observe','观察海鱼的游姿'],['coast-rest',22,'rest','在营地歇脚'],['market-look',9,'observe','看看集市的新鲜货品']],
 [['herb-notes',7,'arrange','翻阅药草观察笔记'],['greenhouse-rest',14,'observe','看看温室植物'],['self-care',19,'rest','给自己留一段休息时间']],
 [['quiet-reading',7,'arrange','安静翻阅航海日志'],['collection-reading',18,'observe','看看藏品的说明'],['fireside-reading',19,'rest','在壁炉边休息']],
 [['craft-watch',0,'observe','看看工坊的工具陈列'],['stone-study',18,'observe','欣赏矿石与藏品'],['miner-rest',22,'rest','在营地舒展筋骨']],
 [['piano-practice',12,'perform','练习一段旋律'],['stage-practice',21,'perform','在舞台练习节奏'],['music-reading',7,'arrange','翻阅曲谱与故事']],
 [['color-study',24,'paint','练习配色与线条'],['outfit-study',4,'observe','欣赏服装搭配'],['flower-study',3,'observe','寻找花束里的配色灵感']],
 [['exhibit-visit',18,'observe','慢慢欣赏藏品'],['history-reading',7,'arrange','翻阅岛屿故事'],['photo-visit',13,'observe','欣赏居民的照片']],
 [['harbor-pause',23,'observe','看看码头的日常'],['reading-pause',7,'arrange','安静翻阅岛屿记录'],['steward-rest',19,'rest','短暂休息']],
 [['neighbor-rest',19,'rest','在居民之家歇脚'],['craft-visit',24,'observe','欣赏手作作品'],['camp-pause',22,'rest','在营地放松']]
];
export const RESIDENT_ROUTINES=rows.map(list=>list.map(([id,buildingId,animation,title])=>({id,buildingId,animation,title})));
export const residentLifeClock=s=>Math.max(0,(s.day-1)*900+(s.economy?.daySeconds||0));
export function temperament(profile={}){
 const p=String(profile.personality||'');
 return {quiet:/安静|沉静|慢热|独立|害羞|话少/.test(p),outgoing:/开朗|爽朗|健谈|热心|热情|爱分享/.test(p),curious:/好奇|新鲜|灵活|大胆/.test(p)};
}
export function routineFor(id,intent){return intent?.action==='visit'?RESIDENT_ROUTINES[id]?.find(r=>'life:'+r.id===intent.purposeId&&r.buildingId===intent.buildingId):null;}
export function socialBoundary(s,a,b,kind='space'){
 const now=residentLifeClock(s);return s.residentLife?.boundaries?.find(x=>x.kind===kind&&x.people.includes(a)&&x.people.includes(b)&&now<x.until)||null;
}
export function recordSocialOutcome(s,row){
 if(!row||!s.npcConversations?.some(r=>r.id===row.id&&r.day===row.day)||!Array.isArray(row.participants)||row.participants.length!==2||!row.participants.every(i=>Number.isInteger(i)&&i>=0&&i<15)||row.participants[0]===row.participants[1]||!Array.isArray(row.changes))return false;
 const book=s.residentLife??={version:1,boundaries:[],receipts:[]};if(book.receipts.includes(row.id))return false;
 book.receipts.push(row.id);book.receipts=book.receipts.slice(-80);const now=residentLifeClock(s),people=[...row.participants].sort((a,b)=>a-b),same=b=>b.people[0]===people[0]&&b.people[1]===people[1];
 book.boundaries=book.boundaries.filter(b=>b.until>now);
 const changes=row.changes.filter(c=>people.includes(c.from)&&people.includes(c.to)&&c.from!==c.to);
 const tension=changes.reduce((n,c)=>n+(Number(c.tension)||0),0);
 const put=(kind,seconds,reason)=>{book.boundaries=book.boundaries.filter(b=>!same(b)||b.kind!==kind);book.boundaries.push({people,kind,until:now+seconds,sourceId:row.id,reason});};
 if(row.type==='dispute'||row.type==='reconcile'&&tension>=0){put('space',900,'上次谈话仍有分歧，先给彼此一天空间');}
 if(row.type==='reconcile'&&tension<0)book.boundaries=book.boundaries.filter(b=>!same(b)||b.kind!=='space');
 if(row.type==='confession'){
  const accepted=changes.some(c=>c.from===row.participants[1]&&c.to===row.participants[0]&&(c.affection||0)>0);
  if(!accepted)put('romance',2700,'对方希望先做朋友，三天内不重复表达心意');
  else book.boundaries=book.boundaries.filter(b=>!same(b)||b.kind!=='romance');
 }
 book.boundaries=book.boundaries.slice(-60);return true;
}
export function validResidentLife(s){
 const b=s.residentLife;if(b===undefined)return true;
 return !!b&&b.version===1&&Array.isArray(b.receipts)&&b.receipts.length<=80&&b.receipts.every(id=>typeof id==='string'&&id.length<=160)&&new Set(b.receipts).size===b.receipts.length&&Array.isArray(b.boundaries)&&b.boundaries.length<=60&&b.boundaries.every(x=>x&&Array.isArray(x.people)&&x.people.length===2&&x.people.every(i=>Number.isInteger(i)&&i>=0&&i<15)&&x.people[0]<x.people[1]&&['space','romance'].includes(x.kind)&&Number.isFinite(x.until)&&x.until>=0&&typeof x.sourceId==='string'&&x.sourceId.length<=160&&typeof x.reason==='string'&&x.reason.length<=160);
}
export function socialCandidates(s,id,profile={}){
 // Agent conversations use their own runtime; ordinary resident pair meetings support ids 0–14.
 if(!Number.isInteger(id)||id<0||id>=15)return [];
 const traits=temperament(profile),preferred=(profile.relationships||[]).map(r=>r.target),recent=(s.npcConversations||[]).filter(c=>c.participants?.includes(id)).slice(-3);
 return Array.from({length:15},(_,j)=>j).filter(j=>j!==id).map(j=>{
  const rel=s.npcRelations?.[id]?.[j]||{},back=s.npcRelations?.[j]?.[id]||{},p=s.npcPresence?.find(p=>p.id===j),n=s.npcNeeds?.[j]||{energy:78,hunger:76};
  if(p&&(p.meeting||p.assignment||p.partyControlled||p.recruitControlled)||n.energy<=30||n.hunger<=30||socialBoundary(s,id,j))return null;
  const familiar=preferred.includes(j)||rel.interactions>0,repeat=recent.filter(c=>c.participants.includes(j)).length;
  // A warm relationship matters, but cannot monopolize every new conversation.
  const score=(rel.tension>12?55:0)+(preferred.includes(j)?14:0)+Math.min(16,(rel.trust||0)*.8)+Math.min(10,(rel.affinity||0)*.4)-repeat*18+(traits.quiet&&familiar?8:0)+(traits.curious&&!rel.interactions?8:0)-(back.affinity< -12?16:0);
  return {id:j,rel,score,familiar,romanceAllowed:!socialBoundary(s,id,j,'romance')};
 }).filter(Boolean).sort((a,b)=>b.score-a.score||Number(b.familiar)-Number(a.familiar)||a.id-b.id);
}
export function leisureOptions(s,id,profile,{breakDue=false,mainWaiting=false,crowd=()=>0}={}){
 const routines=RESIDENT_ROUTINES[id]||[],history=s.npcCareers?.[id]?.history||[],visits=history.filter(h=>h.action==='visit'),recent=visits.slice(-3),today=visits.filter(h=>h.day===s.day),traits=temperament(profile),unsettled=['不满','委屈','难过','烦躁'].includes(s.npcNeeds?.[id]?.mood);
 return routines.filter(r=>s.buildings[r.buildingId]!==undefined).map((r,index)=>{
  const seen=recent.filter(h=>h.purposeId==='life:'+r.id).length,occupancy=crowd(r.buildingId),tense=(s.npcPresence||[]).some(p=>p.id!==id&&(p.inside===r.buildingId||p.buildingId===r.buildingId)&&((s.npcRelations?.[id]?.[p.id]?.tension||0)>12||socialBoundary(s,id,p.id)));
  const calm=[7,19,22,5,14].includes(r.buildingId),variety=traits.curious?12:8;
  const score=(breakDue?72:28)-index*2-seen*variety-(today.some(h=>h.purposeId==='life:'+r.id)?8:0)-occupancy*(traits.quiet?15:9)-(tense?28:0)+(traits.quiet&&calm?4:0)+(unsettled&&calm?10:0);
  const reason=(unsettled?'给自己一点时间，':mainWaiting?'手上的工作正等待条件，':breakDue?'完成一段工作后，':'空闲时想')+r.title+(occupancy>2?'，人多时会换个去处':'');
  return {goal:BUILDINGS[r.buildingId].kind,buildingId:r.buildingId,action:'visit',activity:'leisure',duration:14,purposeId:'life:'+r.id,score,reason};
 }).sort((a,b)=>b.score-a.score).slice(0,2);
}
export function residentLifeSummary(s,id,profile){
 const traits=temperament(profile),visits=(s.npcCareers?.[id]?.history||[]).filter(h=>h.action==='visit'&&h.day===s.day),last=visits.at(-1),boundaries=(s.residentLife?.boundaries||[]).filter(b=>b.people.includes(id)&&b.until>residentLifeClock(s));
 return {rhythm:traits.quiet?'偏爱安静，熟悉之后再慢慢交流':traits.outgoing?'喜欢分享，也会为自己的兴趣留时间':'工作与个人兴趣交替，按近况安排相处',latest:last?.result||'今天还没有完成个人休闲活动',boundaries:boundaries.map(b=>({partnerId:b.people.find(j=>j!==id),text:b.reason,remainingSeconds:Math.ceil(b.until-residentLifeClock(s))}))};
}

export function trimResidentLife(life){
 if(!life||typeof life!=='object')return null;
 const trim=x=>typeof x==='string'?x.slice(0,150):'';
 return {rhythm:trim(life.rhythm),latest:trim(life.latest),boundaries:(Array.isArray(life.boundaries)?life.boundaries:[]).filter(b=>Number.isInteger(b?.partnerId)&&b.partnerId>=0&&b.partnerId<15&&Number.isFinite(b.remainingSeconds)&&b.remainingSeconds>0).slice(0,4).map(b=>({partnerId:b.partnerId,text:trim(b.text),remainingSeconds:Math.min(2700,b.remainingSeconds)}))};
}
