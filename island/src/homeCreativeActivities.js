const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const dayOK=day=>{if(!Number.isSafeInteger(day)||day<1||day>9999999)throw Error('invalid_home_challenge');};
const shuffle=(values,r)=>{const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
export const HOME_NOTES=[{name:'Do',solfege:'1',midi:60,key:'a'},{name:'Re',solfege:'2',midi:62,key:'s'},{name:'Mi',solfege:'3',midi:64,key:'d'},{name:'Fa',solfege:'4',midi:65,key:'f'},{name:'Sol',solfege:'5',midi:67,key:'g'},{name:'La',solfege:'6',midi:69,key:'h'},{name:'Si',solfege:'7',midi:71,key:'j'}];
export const MELODY_BEAT=.42;
export const beatsForHold=seconds=>Number.isFinite(seconds)&&seconds>=0&&seconds<=60?(seconds>=MELODY_BEAT*1.45?2:1):null;
export function melodyChallenge(day){
 dayOK(day);const random=rng(day*7121+198),longs=new Set(shuffle([1,2,3,4,5,6],random).slice(0,2));let note=Math.floor(random()*7);
 const solution=Array.from({length:8},(_,i)=>{if(i){const choices=[-2,-1,1,2].map(n=>note+n).filter(n=>n>=0&&n<7);note=choices[Math.floor(random()*choices.length)];}return {note,beats:longs.has(i)?2:1};});
 return {kind:'melody',day,beat:MELODY_BEAT,solution,board:[]};
}
const validNote=p=>p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).length===2&&Number.isInteger(p.note)&&p.note>=0&&p.note<7&&[1,2].includes(p.beats);
export function melodyIssues(c,board){if(!Array.isArray(board)||board.length!==8||!board.every(validNote))return {complete:false,wrong:[]};return {complete:true,wrong:board.flatMap((p,i)=>p.note!==c.solution[i].note||p.beats!==c.solution[i].beats?[i]:[])};}
export function melodySolved(c,board){const s=melodyIssues(c,board);return s.complete&&!s.wrong.length;}
export const midiFrequency=n=>440*2**((n-69)/12);

export const HOME_SWATCHES=[
 {name:'靛蓝棉布',color:'#526e99',light:'#91a6bf',pattern:'plain'},
 {name:'珊瑚亚麻',color:'#bc766b',light:'#e0b0a2',pattern:'linen'},
 {name:'金黄毛呢',color:'#c8a052',light:'#ead09a',pattern:'felt'},
 {name:'鼠尾草斜纹',color:'#7e987e',light:'#b9c9a0',pattern:'twill'},
 {name:'奶油缎面',color:'#e0d3ad',light:'#fff0cb',pattern:'satin'},
 {name:'梅紫绒布',color:'#8e718f',light:'#b9a0b0',pattern:'velvet'}
];
export const SWATCH_ROLES=['主布','内衬','滚边','扣饰'];
export const HOME_SWATCH_BRIEFS=[
 {name:'海风午后',main:[0,3,4],edge:[0,1,3],tip:'主布选靛蓝、鼠尾草或奶油；滚边使用棉布、亚麻或斜纹。'},
 {name:'落叶散步',main:[1,2,5],edge:[0,2,3],tip:'主布选珊瑚、金黄或梅紫；滚边使用棉布、毛呢或斜纹。'},
 {name:'星灯小聚',main:[0,4,5],edge:[1,4,5],tip:'主布选靛蓝、奶油或梅紫；滚边使用亚麻、缎面或绒布。'},
 {name:'春日来信',main:[1,3,4],edge:[0,1,4],tip:'主布选珊瑚、鼠尾草或奶油；滚边使用棉布、亚麻或缎面。'}
];
export function swatchChallenge(day){dayOK(day);const random=rng(day*8167+198),brief=HOME_SWATCH_BRIEFS[Math.floor(random()*4)],pick=a=>a[Math.floor(random()*a.length)],secret=[pick(brief.main),Math.floor(random()*6),pick(brief.edge),Math.floor(random()*6)];return {kind:'swatch',day,secret,maxGuesses:12,board:[],theme:brief.name,brief};}
export const swatchAllowed=(c,role,sample)=>Number.isInteger(role)&&role>=0&&role<4&&Number.isInteger(sample)&&sample>=0&&sample<6&&(role===0?c.brief.main.includes(sample):role===2?c.brief.edge.includes(sample):true);
export const validSwatchGuess=guess=>Array.isArray(guess)&&guess.length===4&&guess.every(n=>Number.isInteger(n)&&n>=0&&n<6);
export function swatchFeedback(secret,guess){
 if(!validSwatchGuess(secret)||!validSwatchGuess(guess))return null;
 let exact=0;const wanted=Array(6).fill(0),used=Array(6).fill(0);
 for(let i=0;i<4;i++){if(secret[i]===guess[i])exact++;else{wanted[secret[i]]++;used[guess[i]]++;}}
 return {exact,misplaced:wanted.reduce((sum,count,i)=>sum+Math.min(count,used[i]),0)};
}
export function swatchSolved(c,board){return Array.isArray(board)&&board.length>0&&board.length<=c.maxGuesses&&board.every(row=>validSwatchGuess(row)&&row.every((n,i)=>swatchAllowed(c,i,n)))&&board.every((row,i)=>i===board.length-1?swatchFeedback(c.secret,row).exact===4:swatchFeedback(c.secret,row).exact<4);}
export const homeCreativeChallenge=(id,day)=>id===12?melodyChallenge(day):id===13?swatchChallenge(day):null;
export const homeCreativeSolved=(c,board)=>c.kind==='melody'?melodySolved(c,board):c.kind==='swatch'?swatchSolved(c,board):false;
export function evaluateCreativeActivity(input,day){const c=homeCreativeChallenge(input.homeId,day);if(!c||!homeCreativeSolved(c,input.board))return null;return {homeId:input.homeId,kind:c.kind,day,board:structuredClone(input.board),title:c.kind==='melody'?'弦风八音':'彩线配色委托'};}
