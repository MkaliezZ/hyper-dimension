import {trackSpecialization,specializationBrief} from './specialization.js';
import {trackPlayerAchievement,trackHostedAchievement} from './achievements.js';
// V21: player-authored milestones. Automatic NPC production never advances these counters.
export const JOURNEY_STEPS=[
 {id:'meet',title:'认识你的管家',detail:'打开管家，看看当前目标。之后随时可以回来追问。',action:'steward',button:'去见管家'},
 {id:'plant',title:'种下第一片希望',detail:'去农田选一块空田：松土 → 播种小麦 → 浇水。生长期间先去采集。',action:'farm',button:'前往农田'},
 {id:'gather',title:'带回三份木材',detail:'去林地亲手采集木材 ×3。初始库存和居民产出不计入这一页。',action:'wood',button:'去采集木材'},
 {id:'mine',title:'敲开一条矿脉',detail:'去矿洞挥镐，矿脉碎开后亲手取得矿石。',action:'mine',button:'前往矿洞'},
 {id:'craft',title:'做出第一盏星灯',detail:'进入木作工坊，用木材与矿石制作灯笼。完成后可点亮广场。',action:'lantern',button:'查看灯笼图纸'},
 {id:'order',title:'让手艺变成收入',detail:'在经营手账完成一笔岛主订单；不足的物资可从订单直接查看来源。',action:'business',button:'查看今日订单'},
 {id:'harvest',title:'收获亲手种的小麦',detail:'回农田查看生长进度，成熟后挥动镰刀收获。收获物可以用于派对。',action:'farm',button:'照看农田'},
 {id:'invite',title:'把好消息告诉邻居',detail:'备好小麦与灯笼，亲自邀请阿岚、露露参加星灯夜集。',action:'invite',button:'邀请居民'},
 {id:'party',title:'办一场属于你的夜集',detail:'备好灯笼 ×1、小麦 ×2、8 岛币，完成四次放飞，让第一场夜集成为共同回忆。',action:'party',button:'筹备星灯夜集'}
];
export const MOMENTS=[
 {id:'light',title:'首盏星灯',eyebrow:'一盏灯，点亮一个开始',description:'你亲手做的星灯，终于在广场亮起。以后每次路过，它都会在这里。',condition:'亲手制作 1 盏灯笼',reward:'广场星灯装置 · 播种补给 ×2',items:{seed:2},art:'lantern',chapters:['街灯慢慢亮起','手作的光，有了归处','第一盏星灯，永远留在岛上'],quote:'阿岚：下次经过广场，我就知道这是你做的那盏灯。'},
 {id:'trade',title:'开张大吉',eyebrow:'第一次，被这座岛需要',description:'第一笔亲手交付的订单完成了。集市挂起彩旗，庆祝你从采集者成为小岛的经营者。',condition:'完成 1 笔岛主订单',reward:'集市庆典彩旗 · 棉花 ×2、草药 ×2',items:{cotton:2,herb:2},art:'bouquet',chapters:['集市传来好消息','彩旗为第一次交付展开','小小的手艺，也能撑起生活'],quote:'露露：这份心意被人带回家了。好生意，就是这样开始的。'},
 {id:'festival',title:'星灯之夜',eyebrow:'一个人的准备，一座岛的回忆',description:'四盏星灯越过屋顶。邀请、收集、制作与放飞，终于成为你们共同的夜晚。',condition:'亲自承办并完成 1 场星灯夜集',reward:'广场星环纪念碑 · 阿岚、露露好感各 +5',items:{},art:'firework',chapters:['今晚，广场属于大家','星灯越过屋顶，烟花在海面绽放','这座岛记住了你举办的夜晚'],quote:'赫尔墨斯：是你让这些分散的小事，变成了大家共同的故事。'},
 {id:'signature',title:'海岛名片',badge:'海岛主理人',eyebrow:'晨光，开始被远方记住',description:'多样的手艺、用心的设施和共同的庆典，让这座岛有了自己的名字。',condition:'在 5 种建筑亲手制作；3 座设施品质 ≥55；累计接待 12 位旅人；完成 1 场派对',reward:'港口星帆标志 ·「海岛主理人」纪念章',items:{},art:'painting',chapters:['海风带来了远方的问候','每一份用心都汇成岛屿的名字','你的海岛名片，正式启航'],quote:'赫尔墨斯：这里已经是值得专程前来的地方了。'}
];
const count=v=>Math.max(0,Math.floor(Number(v)||0));
export function hydrateJourney(s){
 if(!s.journey){
  // Only receipts with player provenance are migrated; legacy tasks/craftHistory can be NPC-produced.
  const orders=Object.keys(s.economy?.cashReceipts||{}).filter(k=>k.startsWith('town-order-')).length;
  const parties=count(s.activities);
  s.journey={version:1,stats:{orders,parties,gathered:{},crafted:{},buildings:{},watered:0,harvested:0,met:false,invited:parties>0},ready:{},claimed:{},completed:{},compact:false};
 }
 const j=s.journey;j.stats??={};j.stats.nightParties??=Math.max(0,count(j.stats.parties)-count((s.fishingParty?.history||[]).filter(g=>g.phase==='claimed').length));for(const k of ['gathered','crafted','buildings'])j.stats[k]??={};
 j.ready??={};j.claimed??={};j.completed??={};return j;
}
export function trackJourney(s,event,data={}){
 trackPlayerAchievement(s,event,data);
 if(event==='party'&&(data.kind==null||data.kind==='night')&&data.eventId&&s.economy?.cashReceipts?.[data.eventId])trackHostedAchievement(s,{id:data.eventId,template:'night',day:s.day});
 const j=hydrateJourney(s),t=j.stats;
 if(event==='meet')t.met=true;
 if(event==='gather'&&data.item&&count(data.amount))t.gathered[data.item]=count(t.gathered[data.item])+count(data.amount);
 if(event==='water')t.watered=count(t.watered)+1;
 if(event==='harvest'&&data.item==='wheat')t.harvested=count(t.harvested)+count(data.amount);
 if(event==='craft'&&data.item){t.crafted[data.item]=count(t.crafted[data.item])+1;if(Number.isInteger(data.building))t.buildings[data.building]=true}
 if(event==='order')t.orders=count(t.orders)+1;
 if(event==='invite'&&s.partyInvites?.[0]&&s.partyInvites?.[2])t.invited=true;
 if(event==='party'){t.parties=count(t.parties)+1;if((data.kind==null||data.kind==='night')){t.nightParties=count(t.nightParties)+1;t.invited=true}}
 trackSpecialization(s,event,data);
 return refreshJourney(s);
}
export function refreshJourney(s){
 const j=hydrateJourney(s),t=j.stats;
 const flags={meet:t.met,plant:t.watered>0,gather:t.gathered.wood>=3,mine:t.gathered.ore>0,craft:t.crafted.lantern>0,order:t.orders>0,harvest:t.harvested>0,invite:t.invited,party:t.nightParties>0};
 for(const [id,yes] of Object.entries(flags))if(yes)j.completed[id]=true;
 const unlocked={light:t.crafted.lantern>0,trade:t.orders>0,festival:t.nightParties>0,signature:Object.keys(t.buildings).length>=5&&Object.values(s.facilities||{}).filter(f=>Math.min(f.quality||0,55+Math.min(4,Math.max(0,f.upgrades||0))*10)*(.7+.3*Math.max(0,Math.min(100,f.condition??100))/100)>=55).length>=3&&(s.economy?.arrivals||0)>=12&&t.parties>0};
 for(const m of MOMENTS)if(unlocked[m.id]&&!j.ready[m.id]&&!j.claimed[m.id])j.ready[m.id]={day:s.day};
 return j;
}
export function journeyView(s){
 const steps=s.startMode==='zero'?['meet','gather','mine','craft','plant','order','harvest','invite','party'].map(id=>JOURNEY_STEPS.find(x=>x.id===id)):JOURNEY_STEPS;
 const j=refreshJourney(s),index=steps.findIndex(x=>!j.completed[x.id]);
 const step=index<0?null:steps[index];
 const ready=MOMENTS.find(m=>j.ready[m.id]&&!j.claimed[m.id]);
 return {steps,step,index:index<0?steps.length:index,total:steps.length,done:steps.filter(x=>j.completed[x.id]).length,ready,j};
}
export function momentProgress(s,id){
 const j=refreshJourney(s),t=j.stats;
 if(id==='light')return '亲手制作 '+Math.min(1,t.crafted.lantern||0)+' / 1 盏';
 if(id==='trade')return '岛主订单 '+Math.min(1,t.orders||0)+' / 1 笔';
 if(id==='festival')return '承办夜集 '+Math.min(1,t.nightParties||0)+' / 1 场';
 return '手作建筑 '+Math.min(5,Object.keys(t.buildings).length)+'/5 · 优质设施 '+Math.min(3,Object.values(s.facilities||{}).filter(f=>Math.min(f.quality||0,55+Math.min(4,Math.max(0,f.upgrades||0))*10)*(.7+.3*Math.max(0,Math.min(100,f.condition??100))/100)>=55).length)+'/3 · 旅人 '+Math.min(12,s.economy?.arrivals||0)+'/12 · 派对 '+Math.min(1,t.parties||0)+'/1';
}
export function claimMoment(s,id){
 const m=MOMENTS.find(m=>m.id===id),j=refreshJourney(s);if(!m||!j.ready[id]||j.claimed[id])return false;
 j.claimed[id]={day:s.day};delete j.ready[id];
 for(const [item,amount] of Object.entries(m.items)){s.inventory[item]=(s.inventory[item]||0)+amount;s.discovered??={};s.discovered[item]=true}
 if(id==='festival'){s.npcAffinity??={};for(const i of [0,2])s.npcAffinity[i]=Math.min(100,(s.npcAffinity[i]??20)+5)}
 s.events??=[];s.events.unshift('岛屿纪念 · '+m.title+'：'+m.reward);s.events=s.events.slice(0,7);
 s.npcMemory??={};s.npcMemory[15]??=[];s.npcMemory[15].push({day:s.day,text:'与岛主一起见证了「'+m.title+'」。'});s.npcMemory[15]=s.npcMemory[15].slice(-16);
 return m;
}
export function journeyBrief(s){const v=journeyView(s);return {step:v.step?.title||'自由经营',guidance:v.step?.detail||'继续探索手作与海岛名片。',ready:v.ready?.title||null,growth:specializationBrief(s),earned:MOMENTS.filter(m=>v.j.claimed[m.id]).map(m=>m.title),party:{invited:s.partyInvites||{},lantern:s.inventory.lantern||0,wheat:s.inventory.wheat||0,coins:s.coins}}}

