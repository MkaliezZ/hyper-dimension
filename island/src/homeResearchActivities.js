const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const dayOK=day=>{if(!Number.isSafeInteger(day)||day<1||day>9999999)throw Error('invalid_home_challenge');};
const shuffle=(a,r)=>{const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
const stories=[
 {title:'雾湾航海日志',events:['灯塔发现雾带','船队暂缓离港','向导确认航标','货船驶离内湾','船员完成卸货','值守员归还日志'],authors:['灯塔值守员','当班船长','带队向导','港口记录员','卸货负责人','档案接收员']},
 {title:'老木桥修缮记',events:['巡桥发现松动','工匠勘查桥面','木料送到工地','桥板修复完成','巡查通过试行','小桥恢复通行'],authors:['晨巡队员','现场木匠','送货船员','施工负责人','试行记录员','桥口值守员']},
 {title:'海风集市筹备录',events:['居民提出集市','广场测量摊位','摊主提交名单','物资完成清点','乐手抵达广场','第一位来客入场'],authors:['居民议事记录员','测量员','登记负责人','物资清点员','乐手本人','入口值守员']}
];
export const archiveTime=t=>'第'+Math.floor(t/24)+'日 '+String(t%24).padStart(2,'0')+':00';
export function archiveChallenge(day){
 dayOK(day);const random=rng(day*5051+197),story=stories[Math.floor(random()*stories.length)];let time=(2+Math.floor(random()*8))*24+6;
 const entries=story.events.map((title,index)=>{time+=2+Math.floor(random()*5);const at=time,options=shuffle([
  {label:'现场原始记录',author:story.authors[index],text:'“'+title+'”已完成；记录的发生时刻为'+archiveTime(at)+'。',time:at,verified:true},
  {label:'后来的来信',author:'一位参与者',text:'还记得“'+title+'”那天。信封日期是'+archiveTime(at+48)+'，具体发生时刻已记不清。',time:at+48,verified:false},
  {label:'活动预告单',author:'宣传便笺',text:'预告会有“'+title+'”；'+archiveTime(at-4)+'是印刷时刻，未记录活动实际发生的时刻。',time:at-4,verified:false}
 ],random);return {title,at,options,correct:options.findIndex(o=>o.verified)};});
 const order=shuffle([0,1,2,3,4,5],random),events=order.map(i=>entries[i]),solutionOrder=[0,1,2,3,4,5].sort((a,b)=>events[a].at-events[b].at);
 return {kind:'archive',day,title:story.title,events,palette:shuffle([0,1,2,3,4,5],random),board:Array(12).fill(null),solution:[...solutionOrder,...events.map(e=>e.correct)]};
}
export function archiveIssues(c,board){
 if(!Array.isArray(board)||board.length!==12)return {shape:false,sources:0,ordered:false,complete:false};
 const order=board.slice(0,6),choices=board.slice(6),valid=v=>Number.isInteger(v)&&v>=0&&v<6;
 const complete=order.every(valid)&&new Set(order).size===6,sourceCount=choices.filter((v,i)=>Number.isInteger(v)&&v===c.events[i].correct).length;
 return {shape:true,sources:sourceCount,complete,ordered:complete&&order.every((v,i)=>i===0||c.events[order[i-1]].at<c.events[v].at)};
}
export function archiveSolved(c,board){const s=archiveIssues(c,board);return s.shape&&s.sources===6&&s.ordered;}
export function placeArchive(board,event,slot){
 if(!Array.isArray(board)||board.length!==12||!Number.isInteger(event)||event<0||event>=6||!Number.isInteger(slot)||slot<0||slot>=6)return null;
 const out=[...board],old=out.slice(0,6).indexOf(event),displaced=out[slot];out[slot]=event;if(old>=0&&old!==slot)out[old]=displaced;return out;
}

export function strataChallenge(day){
 dayOK(day);const random=rng(day*6197+197),tiles=shuffle([0,1,2,3,4,5,6,7,8],random),board=tiles.map(tile=>({tile,r:Math.floor(random()*4)}));
 if(board.every((p,i)=>p.tile===i&&p.r===0))board[0].r=1;
 return {kind:'strata',day,seed:Math.floor(random()*999999),board,solution:Array.from({length:9},(_,tile)=>({tile,r:0}))};
}
export function validStrata(board){return Array.isArray(board)&&board.length===9&&board.every(p=>p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).length===2&&Number.isInteger(p.tile)&&p.tile>=0&&p.tile<9&&Number.isInteger(p.r)&&p.r>=0&&p.r<4)&&new Set(board.map(p=>p.tile)).size===9;}
export const strataSolved=(c,board)=>validStrata(board)&&board.every((p,i)=>p.tile===i&&p.r===0);
export function swapStrata(board,a,b){if(!validStrata(board)||![a,b].every(i=>Number.isInteger(i)&&i>=0&&i<9))return null;const out=board.map(p=>({...p}));[out[a],out[b]]=[out[b],out[a]];return out;}
export function turnStrata(board,i,delta=1){if(!validStrata(board)||!Number.isInteger(i)||i<0||i>=9||![-1,1].includes(delta))return null;return board.map((p,n)=>({...p,r:n===i?(p.r+delta+4)%4:p.r}));}
export function strataConnections(board){
 if(!validStrata(board))return [];
 const links=[];for(let i=0;i<9;i++)for(const step of [1,3]){const j=i+step;if(j>=9||step===1&&i%3===2)continue;const a=board[i],b=board[j];if(a.r===0&&b.r===0&&b.tile===a.tile+step&&(step!==1||a.tile%3<2))links.push([i,j]);}return links;
}
export function strataSVG(c,style='origami'){
 const random=rng(c.seed),palette=['#dae0ba','#ba946b','#849f9c','#bdb099','#6c7b83'],parts=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360">'];
 const boundaries=[0,...[65,132,204,278].map(y=>y+Math.floor(random()*22)),360],points=boundaries.map((y,i)=>Array.from({length:10},(_,x)=>[x*40,i===0?0:i===5?360:y+Math.sin(x*.65+i)*15+(x>5?12:0)]));
 for(let i=0;i<5;i++){const poly=[...points[i],...points[i+1].toReversed()];parts.push('<polygon points="'+poly.map(p=>p.join(',')).join(' ')+'" fill="'+palette[i]+'" stroke="#544f4260" stroke-width="2"/>');}
 for(let i=0;i<65;i++){const x=8+random()*344,y=12+random()*336,w=2+random()*8;parts.push(style==='pixel'?'<rect x="'+Math.round(x)+'" y="'+Math.round(y)+'" width="'+Math.round(w)+'" height="3" fill="#413b3235"/>':'<path d="M'+x+','+y+'l'+w+',-3 2,5z" fill="#f7e5b657"/>');}
 parts.push('<path d="M-5 305Q80 290 115 222T225 155T370 80" fill="none" stroke="#f6e9c5" stroke-width="9"/><path d="M-5 305Q80 290 115 222T225 155T370 80" fill="none" stroke="#9e876b" stroke-width="2"/>');
 // Every slice has a distinct asymmetric inclusion as well as continuous layer boundaries.
 for(let tile=0;tile<9;tile++){const x=tile%3*120+22+random()*62,y=Math.floor(tile/3)*120+24+random()*55,n=3+tile;parts.push('<path d="M'+x+','+y+'l'+(8+n)+',-7 12,8 -5,12 -13,2z" fill="#e2c37d" stroke="#695e46" stroke-width="2"/>');for(let j=0;j<n;j++)parts.push('<circle cx="'+(x+3+j*1.4)+'" cy="'+(y+2+j%2*3)+'" r="1" fill="#695e46"/>');}
 parts.push('<path d="M0 9H360" stroke="#6e8452" stroke-width="12"/>','</svg>');return parts.join('');
}
export const homeResearchChallenge=(id,day)=>id===10?archiveChallenge(day):id===11?strataChallenge(day):null;
export const homeResearchSolved=(c,board)=>c.kind==='archive'?archiveSolved(c,board):c.kind==='strata'?strataSolved(c,board):false;
export function evaluateResearchActivity(input,day){const c=homeResearchChallenge(input.homeId,day);if(!c||!homeResearchSolved(c,input.board))return null;return {homeId:input.homeId,kind:c.kind,day,board:structuredClone(input.board),title:c.kind==='archive'?'六页航海录':'地层标本复原'};}
