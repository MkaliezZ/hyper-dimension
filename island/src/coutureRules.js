import {seededRandom,shuffle} from './gameLevels.js';
import {GARMENTS} from './equipmentRules.js';
import {validCraftEvent} from './craftGameReplay.js';
export const COUTURE_BASE=Object.freeze({c4_1:1,c4_9:1,c4_3:1,c4_10:1,c4_5:1,c4_6:1});
export const COUTURE_EQUIPMENT=Object.freeze({...COUTURE_BASE,c8_2:1});
export const COUTURE_SLOTS=Object.freeze(['body','head','outer','hands','apron','bottom']);
export const COUTURE_POSES=Object.freeze(['wave','turn','bow']);
export const COUTURE_THEMES=Object.freeze(['海风航海','花园手作','星夜舞会']);
export const COUTURE_CLOTHES=Object.freeze([
 ['c4_1',3,[3,3,1],4],['c4_9',5,[6,1,2],3],['c4_8',6,[1,5,5],2],['c4_11',5,[2,2,6],2],
 ['c4_7',3,[3,2,1],3],['c4_3',2,[4,4,0],3],['c4_10',4,[2,1,5],1],['c4_4',2,[1,3,0],4],
 ['c4_5',3,[1,5,2],3],['c4_6',5,[1,1,6],2],['c4_2',2,[1,5,0],4]
].map(([id,cost,tags,comfort])=>Object.freeze({id,slot:GARMENTS[id].slot,onePiece:!!GARMENTS[id].onePiece,cost,tags:Object.freeze(tags),comfort})));
const byId=Object.fromEntries(COUTURE_CLOTHES.map(i=>[i.id,i])),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),record=v=>!!v&&typeof v==='object'&&!Array.isArray(v),integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const empty=()=>Object.fromEntries(COUTURE_SLOTS.map(k=>[k,null])),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function validCoutureOutfit(outfit,wardrobe){return record(outfit)&&Object.keys(outfit).length===6&&COUTURE_SLOTS.every(slot=>Object.hasOwn(outfit,slot)&&(outfit[slot]===null||wardrobe.includes(outfit[slot])&&byId[outfit[slot]]?.slot===slot))&&!(byId[outfit.body]?.onePiece&&outfit.bottom);}
export function coutureReview(outfit,brief){
 const selected=Object.values(outfit).map(id=>byId[id]).filter(Boolean),cost=selected.reduce((v,i)=>v+i.cost,0),comfort=selected.reduce((v,i)=>v+i.comfort,0),style=selected.reduce((v,i)=>v+i.tags[brief.theme],0);
 const complete=['body','head','outer'].every(slot=>outfit[slot])&&cost<=brief.budget&&comfort>=brief.comfort&&style>=brief.style&&(!brief.accent||((byId[outfit[brief.accent.slot]]?.tags[brief.theme]||0)>=brief.accent.minimum));
 const unmet=[...['body','head','outer'].filter(slot=>!outfit[slot]).map(slot=>({body:'缺少主服',head:'缺少头饰',outer:'缺少披肩或斗篷'})[slot]),cost>brief.budget?'造型额度超出 '+(cost-brief.budget):null,comfort<brief.comfort?'舒适度还差 '+(brief.comfort-comfort):null,style<brief.style?'主题还差 '+(brief.style-style):null,brief.accent&&(byId[outfit[brief.accent.slot]]?.tags[brief.theme]||0)<brief.accent.minimum?'重点部位的主题表现不足':null].filter(Boolean);
 return {complete,cost,comfort,style,unmet,score:complete?clamp(80+(style-brief.style)*4+(comfort-brief.comfort)*2+(brief.budget-cost)*2,80,100):0};
}
export function coutureSolutions(wardrobe,brief){
 const choices=COUTURE_SLOTS.map(slot=>['body','head','outer'].includes(slot)?wardrobe.filter(id=>byId[id].slot===slot):[null,...wardrobe.filter(id=>byId[id].slot===slot)]),out=[];
 function visit(i,o){if(i===6){if(validCoutureOutfit(o,wardrobe)&&coutureReview(o,brief).complete)out.push({...o});return;}for(const id of choices[i]){o[COUTURE_SLOTS[i]]=id;visit(i+1,o);}}visit(0,empty());return out;
}
function setup(seed,difficulty,wardrobe,excluded,tags){
 const r=seededRandom(seed),pool=shuffle(Array.from({length:15},(_,i)=>i).filter(i=>!excluded.includes(i)),r),models=shuffle([0,4,12],r),themes=tags.map(t=>({sea:0,nature:1,cuisine:1,craft:1,stars:2,music:2})[t]).filter(t=>t!==undefined),rounds=[];
 for(let i=0;i<3;i++){
  const theme=themes.length?themes[i%themes.length]:i,all=coutureSolutions(wardrobe,{theme,budget:99,comfort:0,style:0,accent:null}),exemplar=all[Math.floor(r()*all.length)],review=coutureReview(exemplar,{theme,budget:99,comfort:0,style:0});
  const accentSlot=shuffle(['body','head','outer'],r).find(slot=>byId[exemplar[slot]].tags[theme]>0);
  const brief={index:i,npcId:models[i],theme,themeName:COUTURE_THEMES[theme],request:['海风散步与港口合影','花园演奏与午后茶会','星灯露台与朋友重逢'][theme],budget:review.cost+(difficulty==='easy'?2:Math.floor(r()*2)),comfort:Math.max(4,review.comfort-(difficulty==='easy'?2:1)),style:Math.max(3,review.style-(difficulty==='easy'?3:1)),accent:accentSlot?{slot:accentSlot,minimum:Math.max(1,byId[exemplar[accentSlot]].tags[theme]-(difficulty==='easy'?2:1))}:null,seconds:difficulty==='easy'?120:90,cues:Array.from({length:4},()=>COUTURE_POSES[Math.floor(r()*3)])};
  if(!coutureSolutions(wardrobe,brief).length)throw Error('Unreachable couture brief');rounds.push(brief);
 }return {models,rounds};
}
export function createCoutureGame(seed,difficulty='normal',wardrobe=Object.keys(COUTURE_BASE),excluded=[13,7,2],tags=[]){
 if(!integer(seed,0,0xffffffff)||!['easy','normal'].includes(difficulty)||!Array.isArray(wardrobe)||new Set(wardrobe).size!==wardrobe.length||wardrobe.some(id=>!byId[id])||Object.keys(COUTURE_BASE).some(id=>!wardrobe.includes(id))||!Array.isArray(excluded)||excluded.length<3||excluded.length>4||new Set(excluded).size!==excluded.length||excluded.some(n=>!integer(n,0,14)||[0,4,12].includes(n))||!Array.isArray(tags)||tags.length>2||new Set(tags).size!==tags.length||tags.some(t=>!['sea','nature','cuisine','craft','stars','music'].includes(t)))throw Error('Invalid couture setup');
 wardrobe=[...wardrobe].sort();const level=setup(seed,difficulty,wardrobe,excluded,tags);
 return {engine:'couture-party',version:1,seed,difficulty,wardrobe,excluded:[...excluded],tags:[...tags],level,phase:'checkin',round:0,elapsed:0,clock:0,outfit:empty(),show:null,reports:[],strikes:0,status:'等评审、模特和岛主实际到齐再开始',effectSerial:0,effect:null};
}
export function currentCoutureBrief(g){return g.level.rounds[g.round];}
const emit=(g,type,data={})=>g.effect={id:++g.effectSerial,type,...data};
function gradedReport(g){
 const brief=currentCoutureBrief(g),review=coutureReview(g.outfit,brief),hits=g.show.hits.filter(Boolean).length,prior=g.reports.filter(r=>r.outcome==='shown'&&same(r.outfit,g.outfit)).length;
 const stage=Math.round(hits/4*100),style=review.score,comfort=clamp(80+(review.comfort-brief.comfort)*5,0,100),quality=clamp(Math.round(style*.70+stage*.20+comfort*.10-prior*8-Math.min(8,g.show.mistakes*2)),0,100);
 return {index:g.round,npcId:brief.npcId,outcome:'shown',outfit:structuredClone(g.outfit),hits:[...g.show.hits],mistakes:g.show.mistakes,style,comfort,stage,repeat:prior,quality,judges:[{npcId:13,score:style},{npcId:7,score:Math.round((style+stage)/2)},{npcId:2,score:Math.round((comfort+stage)/2)}]};
}
function concludeRound(g,report){g.reports.push(report);g.phase=g.round===2?'results':'intermission';g.clock=0;emit(g,g.phase==='results'?'result':'round',{npcId:report.npcId,quality:report.quality});}
export function coutureSummary(g){
 const quality=Math.round(g.reports.reduce((v,r)=>v+r.quality,0)/3),poseHits=g.reports.reduce((v,r)=>v+(r.hits||[]).filter(Boolean).length,0),rank=g.reports.map(r=>({npcId:r.npcId,quality:r.quality,index:r.index})).sort((a,b)=>b.quality-a.quality||a.index-b.index);
 return {quality,poseHits,completed:g.reports.filter(r=>r.outcome==='shown').length,passed:g.reports.length===3&&g.reports.every(r=>r.outcome==='shown')&&quality>=65&&poseHits>=6,reward:Math.floor(quality*.54),winner:rank[0]?.npcId??null,rank};
}
export function applyCoutureEvent(g,e){
 if(!validCraftEvent(e))throw Error('Invalid couture input');if(e.neutral)return g;
 if(Object.hasOwn(e,'dt')){
  if(!['styling','showing','review'].includes(g.phase))return g;g.elapsed+=e.dt;g.clock+=e.dt;
  if(g.phase==='styling'&&g.clock>=currentCoutureBrief(g).seconds)concludeRound(g,{index:g.round,npcId:currentCoutureBrief(g).npcId,outcome:'timeout',outfit:structuredClone(g.outfit),hits:[false,false,false,false],mistakes:0,style:0,comfort:0,stage:0,repeat:0,quality:0,judges:[{npcId:13,score:0},{npcId:7,score:0},{npcId:2,score:0}]});
  else if(g.phase==='showing'){g.show.elapsed=g.clock;if(g.clock>=7.2){g.phase='review';g.clock=0;emit(g,'review',{report:gradedReport(g)});}}
  else if(g.phase==='review'&&g.clock>=3.2)concludeRound(g,gradedReport(g));return g;
 }
 const a=e.action;
 if(a.type==='start'){if(!['checkin','intermission'].includes(g.phase))throw Error('Couture round not ready');if(g.phase==='intermission')g.round++;g.phase='styling';g.clock=0;g.outfit=empty();g.show=null;g.status='先选好三类服装，兼顾评审要求';emit(g,'start',{round:g.round});return g;}
 if(a.type==='wear'){
  if(g.phase!=='styling'||!g.wardrobe.includes(a.item))throw Error('Garment unavailable');const i=byId[a.item];g.outfit[i.slot]=i.id;if(i.slot==='body'&&i.onePiece)g.outfit.bottom=null;if(i.slot==='bottom'&&byId[g.outfit.body]?.onePiece)g.outfit.body=null;g.status=coutureReview(g.outfit,currentCoutureBrief(g)).unmet.join(' · ')||'已符合约定，准备沿秀道登台';emit(g,'wear',{item:a.item});return g;
 }
 if(a.type==='remove'){if(g.phase!=='styling'||!COUTURE_SLOTS.includes(a.item))throw Error('Invalid garment slot');g.outfit[a.item]=null;g.status=coutureReview(g.outfit,currentCoutureBrief(g)).unmet.join(' · ');return g;}
 if(a.type==='submit'){
  if(g.phase!=='styling')throw Error('Not styling');const review=coutureReview(g.outfit,currentCoutureBrief(g));
  if(!review.complete){g.strikes++;g.status=review.unmet.join(' · ');emit(g,'invalid');return g;}
  g.phase='walking';g.clock=0;g.show={elapsed:0,hits:[false,false,false,false],attempts:[false,false,false,false],early:[false,false,false,false],mistakes:0};g.status='模特沿真实秀道前往展示位';emit(g,'walk',{npcId:currentCoutureBrief(g).npcId});return g;
 }
 if(a.type==='arrive'){if(g.phase!=='walking'||a.index!==currentCoutureBrief(g).npcId)throw Error('Model not on runway');g.phase='showing';g.clock=0;g.status='观察四个动作提示，在亮拍做出对应姿态';emit(g,'show');return g;}
 if(a.type==='pose'){
  if(g.phase!=='showing'||!COUTURE_POSES.includes(a.item))throw Error('Invalid runway pose');const beat=Math.min(3,Math.floor(g.clock/1.8)),center=beat*1.8+.9,within=Math.abs(g.clock-center)<=(g.difficulty==='easy'?.7:.42);
  if(g.show.attempts[beat])return g;
  if(!within){if(!g.show.early[beat]){g.show.mistakes++;g.show.early[beat]=true;emit(g,'early');}return g;}
  g.show.attempts[beat]=true;g.show.hits[beat]=a.item===currentCoutureBrief(g).cues[beat];if(!g.show.hits[beat])g.show.mistakes++;emit(g,g.show.hits[beat]?'pose':'miss',{pose:a.item,beat});return g;
 }
 throw Error('Unsupported couture event');
}
export function validCoutureGame(g){
 try{
  if(!record(g)||g.engine!=='couture-party'||g.version!==1||!['checkin','styling','walking','showing','review','intermission','results'].includes(g.phase)||!integer(g.round,0,2)||!Number.isFinite(g.elapsed)||g.elapsed<0||g.elapsed>500||!Number.isFinite(g.clock)||g.clock<0||g.clock>121||!integer(g.strikes,0,10000)||!integer(g.effectSerial,0,100000)||typeof g.status!=='string'||g.status.length>300)return false;
  const expected=createCoutureGame(g.seed,g.difficulty,g.wardrobe,g.excluded,g.tags);if(!same(g.level,expected.level)||!validCoutureOutfit(g.outfit,g.wardrobe)||!Array.isArray(g.reports)||g.reports.length>3)return false;
  if(g.show!==null&&(!record(g.show)||!Number.isFinite(g.show.elapsed)||g.show.elapsed<0||g.show.elapsed>7.251||!integer(g.show.mistakes,0,12)||!['hits','attempts','early'].every(k=>Array.isArray(g.show[k])&&g.show[k].length===4&&g.show[k].every(b=>typeof b==='boolean'))||g.show.hits.some((b,i)=>b&&!g.show.attempts[i])))return false;
  for(const [i,report]of g.reports.entries()){
   if(report.index!==i||report.npcId!==g.level.models[i]||!validCoutureOutfit(report.outfit,g.wardrobe))return false;
   const temporary={...g,round:i,outfit:report.outfit,show:{hits:report.hits,mistakes:report.mistakes},reports:g.reports.slice(0,i)};
   if(report.outcome==='shown'){if(!Array.isArray(report.hits)||report.hits.length!==4||report.hits.some(b=>typeof b!=='boolean')||!integer(report.mistakes,0,12)||!coutureReview(report.outfit,g.level.rounds[i]).complete||!same(report,gradedReport(temporary)))return false;}
   else if(report.outcome!=='timeout'||report.quality!==0||report.hits.some(Boolean)||report.style!==0||report.comfort!==0||report.stage!==0||report.mistakes!==0)return false;
  }
  if(g.phase==='results')return g.reports.length===3&&g.round===2;
  if(g.phase==='intermission')return g.reports.length===g.round+1&&g.round<2;
  if(g.reports.length!==g.round)return false;
  if(['walking','showing','review'].includes(g.phase)&&(!g.show||!coutureReview(g.outfit,currentCoutureBrief(g)).complete))return false;
  return g.phase!=='checkin'||g.round===0&&g.elapsed===0&&g.show===null;
 }catch{return false;}
}
