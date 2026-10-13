import {worldBaseEdge} from './worldNavigationEdges.js';
import {ISLAND_GEOGRAPHY,PERMANENT_HOMES} from './islandGeography.js';
import {terrainSurfaceWalkable,terrainMovementCost,TERRAIN_NAVIGATION} from './terrainNavigation.js';
import {PathQueue} from './pathQueue.js';
import {portfolioWalkable,portfolioBlocked,portfolioCoastBlocked} from './portfolioLandmark.js';
import {initializeZeroProgress} from './freshState.js';
import {readSave,writeSave} from './saveStorage.js';
import {CATALOG_ITEMS} from './contentCatalog.js';
import {farmWalkable} from './farming.js';
import {PARCELS,BUILDING_ORDER} from './layouts.js';
import {PERSONAS} from './personas.js';
// Keep island art and parcel anchors in one immutable coordinate space.
export const MAP_EXTENT=Object.freeze({width:2304,height:1792});
export const WORLD = { width:2528, height:2016 };
export const BUILDINGS = [
  ['木作工坊','🛠','workshop','木材与工具制作'],['风铃茶屋','🍵','tea','招待居民与调饮'],['海边食堂','🍲','tea','料理与聚餐'],['花艺小屋','💐','workshop','花束和装饰制作'],['服装店','👗','workshop','派对服装制作'],['观星台','🔭','gallery','夜间观星活动'],['水族馆','🐠','gallery','展示海洋发现'],['图书馆','📚','gallery','知识与居民故事'],['灯塔','🗼','gallery','岛屿航标'],['集市摊位','🛍','tea','交易与集市派对'],['诊所','🏥','tea','照顾居民状态'],['邮局','✉️','gallery','信件与任务'],['音乐馆','🎼','gallery','音乐派对'],['摄影屋','📷','gallery','拍摄岛屿记忆'],['植物温室','🌿','workshop','培育珍稀植物'],['陶艺坊','🏺','workshop','摆件制作'],['渔具铺','🎣','workshop','钓鱼工具制作'],['烘焙屋','🥐','tea','食物制作'],['博物馆','🏛','gallery','奇观收藏'],['居民之家','🏠','tea','居民生活空间'],['烟花工坊','🎆','workshop','烟花大会准备'],['舞台','🎭','gallery','演出与聚会'],['露营站','⛺','gallery','户外活动'],['船坞','⛵','workshop','海上探索'],['工艺学院','🎨','gallery','居民共创与教学']
].map(([name,icon,kind,desc],id)=>({id,name,icon,kind,desc,cost:{wood:id<10?4:id<20?6:8,stone:id<10?3:id<20?4:6,coins:id<10?25:id<20?40:60}}));
export const WORLD_CELL=TERRAIN_NAVIGATION.cell;
export const SLOTS=ISLAND_GEOGRAPHY.production.map(p=>({...p,entry:{...p.entry},view:'elevated-front',axes:[[1,0],[0,.72]]}));
export function worldSlots(theme){return ['pixel','origami'].includes(theme)?SLOTS.map(s=>({...s,entry:{...s.entry}})):[];}
let worldTheme='pixel';
export function setWorldTheme(theme){if(!['pixel','origami'].includes(theme))throw Error('invalid_world_theme');worldTheme=theme;worldDisplayColliders=[];const h=HARBOR_LAYOUTS[theme];for(const key of ['path','apron','arrival','departure','waiting','activities'])HARBOR[key]=h[key].map(([x,y])=>({x,y}));for(const key of ['entrance','gate','boarding','ship','cabin','berth'])HARBOR[key]={...h[key]};HARBOR.sea={x:WORLD.width-80,y:WORLD.height-190};const dock=HOTSPOTS.find(h=>h.type==='dock');Object.assign(dock,{x:HARBOR.gate.x,y:HARBOR.gate.y,entry:{...HARBOR.gate}});}

export function nearestWalkable(x,y){if(worldWalkable(x,y))return {x,y};for(let r=12;r<=300;r+=12)for(let a=0;a<16;a++){const xx=x+Math.cos(a*Math.PI/8)*r,yy=y+Math.sin(a*Math.PI/8)*r;if(worldWalkable(xx,yy))return {x:xx,y:yy}}return {...ISLAND_GEOGRAPHY.spawn}}
export const HOTSPOTS=['farm','forest','mine','plaza','dock'].map(type=>{const p=ISLAND_GEOGRAPHY.landmarks[type==='dock'?'harbor':type];return {type,x:p.x,y:p.y,entry:{...(p.entry||p)},r:({farm:125,forest:170,mine:125,plaza:145,dock:100})[type],label:({farm:'农田',forest:'林地',mine:'矿洞',plaza:'派对广场',dock:'晨光客运码头'})[type]};});
export const ITEMS=Object.fromEntries(CATALOG_ITEMS.map(i=>[i.id,[i.name,'']]));
export const RESIDENTS = [
 ['阿岚','农艺师','#7dbb74',[650,365],['farm','tea'],'温和而坚持','从北方带来的种子专家'],
 ['小墨','工匠','#e5a45f',[916,640],['mine','workshop'],'细心而倔强','热衷修复旧物的学徒'],
 ['露露','活动主持','#bd90d1',[770,386],['plaza','tea'],'开朗而好奇','旅居多岛的派对策划人'],
 ['星野','观星者','#83a9d6',[679,283],['gallery','plaza'],'安静而敏锐','记录流星轨迹的夜行者'],
 ['莉安','花艺师','#d98cae',[562,456],['farm','tea'],'浪漫而爽朗','为每个节日配花的园艺师'],
 ['祁舟','船匠','#71b5a9',[1093,678],['workshop','mine'],'务实而幽默','沿海修船多年的老手'],
 ['桃子','烘焙师','#e7ab77',[1057,439],['tea','farm'],'热情而健忘','会把食谱写在围裙上的厨师'],
 ['南风','摄影师','#79a8c1',[1182,392],['gallery','plaza'],'敏感而耐心','喜欢收集晴天的摄影师'],
 ['小满','鱼贩','#7cc5be',[511,607],['tea','plaza'],'健谈而慷慨','每天清晨去码头的人'],
 ['洛白','医师','#9bc3a6',[875,282],['tea','gallery'],'冷静而体贴','研究岛上药草的医师'],
 ['青禾','图书管理员','#aaa0c8',[598,282],['gallery','tea'],'沉静而博学','守护老航海日志的人'],
 ['岩岩','矿工','#b8a781',[1100,387],['mine','workshop'],'直率而可靠','熟悉每条矿脉的向导'],
 ['黎音','音乐人','#c18a9c',[884,596],['plaza','gallery'],'自由而细腻','想举办海风音乐会'],
 ['桐桐','服装师','#d4a6ba',[469,669],['workshop','plaza'],'大胆而爱美','擅长设计派对主题服'],
 ['知夏','博物馆员','#a3b4d3',[745,655],['gallery','plaza'],'好学而温柔','整理每件奇观的来历'],
 ['赫尔墨斯','Agent 管家','#76bcb5',[835,474],['plaza','workshop'],'审慎而主动','连接现实任务与岛屿活动的管家']
].map(([name,job,color,start,interest,personality,backstory],id)=>({id,name,icon:name==='赫尔墨斯'?'✦':name.slice(0,1),job,color,start:[PERMANENT_HOMES[id].entry.x,PERMANENT_HOMES[id].entry.y],interest,personality,backstory,...PERSONAS[id],kind:id===15?'hermes':'ai',dialogue:[`我在想，${interest[0]==='farm'?'今天的田地':interest[0]==='mine'?'矿洞的新发现':'岛上的新建筑'}会带来什么故事。`,`我喜欢这里。下次活动如果需要${job}，记得叫上我。`]}));
export function unlockRequirement(id,state){
 if(state.buildings[id]!==undefined)return {ready:true,text:'本轮全岛开放体验'};
 const built=Object.keys(state.buildings).length;
 if(id<2)return {ready:true,text:'初始开放'};
 if(id<6)return {ready:state.tasks.farm||state.tasks.mine,text:'完成一次农耕或采矿'};
 if(id<10)return {ready:state.tasks.farm&&state.tasks.mine,text:'完成农田收获与矿洞采集'};
 if(id<15)return {ready:state.tasks.craft&&state.activities>=1,text:'制作灯笼并承办一次派对'};
 if(id<20)return {ready:built>=8&&state.activities>=2,text:'开放 8 座建筑并举办 2 场派对'};
 return {ready:built>=14&&state.activities>=4,text:'开放 14 座建筑并举办 4 场派对'};
}export function createState(){return {coins:120,day:1,inventory:{wood:12,stone:8,seed:8,wheat:0,ore:0,herb:2,fish:0,lantern:0,tea:0,firework:0},buildings:Object.fromEntries(BUILDINGS.map(b=>[b.id,b.id])),plots:Array.from({length:8},()=>({stage:0,growth:0})),oreNodes:Array.from({length:6},()=>({hp:3,regen:0})),tasks:{farm:false,mine:false,craft:false,party:false},partyInvites:{},npcProfiles:{},npcAffinity:{},npcMemory:{},npcNeeds:{},npcRelations:{},npcConversations:[],agentExecutions:[],events:['你踏上了晨光岛，新的生活开始了。'],activities:0,player:{...ISLAND_GEOGRAPHY.spawn},geographyVersion:169}}
export function loadState(theme){try{const saved=readSave(theme);if(saved)return {...createState(),...saved,buildings:Object.fromEntries(BUILDINGS.map(b=>[b.id,b.id]))};}catch{}return initializeZeroProgress(createState())}
export function saveState(theme,state,serialized){writeSave(theme,state,localStorage,serialized)}
const CELL=WORLD_CELL;
// Art-aligned deck surfaces; the beach cannot connect to the bridge's side.
const LEGACY_HARBOR_LAYOUTS={
 pixel:{
  path:[[1128,786],[1180,825],[1230,864],[1280,903],[1332,943]],
  apron:[[1302,931],[1350,923],[1540,923],[1592,948],[1604,982],[1550,987],[1340,987],[1295,968]],
  arrival:[[1600,974],[1565,964],[1355,964],[1328,947],[1276,907],[1226,868],[1176,829],[1123,790],[1104,784]],
  departure:[[1128,786],[1135,776],[1187,815],[1237,854],[1287,893],[1339,933],[1365,953]],
  entrance:{x:1104,y:784},boarding:{x:1600,y:974},ship:{x:1630,y:980},cabin:{x:1640,y:975},
  gate:{x:1480,y:950},berth:{x:1655,y:1020},
  waiting:[[1388,936],[1420,936],[1452,936],[1484,936],[1516,936],[1548,936]],
  activities:[[1313,971],[1330,982],[1362,981]]
 },
 origami:{
  path:[[1138,808],[1188,842],[1238,876],[1288,910],[1328,944]],
  apron:[[1287,924],[1340,923],[1536,956],[1603,985],[1594,1022],[1510,1004],[1310,969],[1278,949]],
  arrival:[[1598,1000],[1560,990],[1358,958],[1323,948],[1284,914],[1234,880],[1184,846],[1134,812],[1112,800]],
  departure:[[1138,808],[1145,798],[1195,832],[1245,866],[1295,900],[1335,934],[1365,948]],
  entrance:{x:1112,y:800},boarding:{x:1598,y:1000},ship:{x:1630,y:1005},cabin:{x:1640,y:1000},
  gate:{x:1470,y:966},berth:{x:1655,y:1045},
  waiting:[[1388,942],[1420,947],[1452,952],[1484,957],[1516,962],[1548,967]],
  activities:[[1295,947],[1315,965],[1340,970]]
 }
};
const dockPoint=(theme,p)=>{const old=LEGACY_HARBOR_LAYOUTS[theme].entrance,anchor=ISLAND_GEOGRAPHY.landmarks.harbor.entry;return {x:anchor.x+(p.x-old.x)*.85,y:anchor.y+(p.y-old.y)*.85};};
export const HARBOR_LAYOUTS=Object.fromEntries(['pixel','origami'].map(theme=>[theme,Object.fromEntries(Object.entries(LEGACY_HARBOR_LAYOUTS[theme]).map(([key,value])=>[key,Array.isArray(value)?value.map(([x,y])=>{const p=dockPoint(theme,{x,y});return[p.x,p.y];}):dockPoint(theme,value)]))]));
export function harborArtRect(theme){const p=dockPoint(theme,{x:1100,y:750});return {...p,w:510*.85,h:340*.85};}
export const HARBOR={};
const harborGeometry=Object.fromEntries(['pixel','origami'].map(theme=>[theme,{path:HARBOR_LAYOUTS[theme].path.map(([x,y])=>({x,y})),apron:HARBOR_LAYOUTS[theme].apron.map(([x,y])=>({x,y}))}]));
let worldDisplayColliders=[];
export function setWorldDisplayColliders(rows=[]){worldDisplayColliders=rows.filter(p=>[p.x,p.y,p.rx,p.ry].every(Number.isFinite)&&p.rx>0&&p.ry>0).map(p=>({...p}));}
setWorldTheme('pixel');
export function pointInPolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside}return inside}
export function nearPolyline(x,y,path,width){for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)||0));if(Math.hypot(x-a.x-dx*t,y-a.y-dy*t)<=width)return true}return false}
export function pierWalkable(x,y){return pointInPolygon(x,y,HARBOR.apron)||nearPolyline(x,y,HARBOR.path,25*.85)}
export function parcelBlocked(s,x,y){return Math.abs(x-s.x)<s.w*.40+4&&y>s.y-12&&y<s.y+s.h/2-2;}
const basePoints={pixel:new Map(),origami:new Map()};
function baseWorldWalkable(theme,x,y){
 if(portfolioBlocked(x,y))return false;const h=harborGeometry[theme];if(pointInPolygon(x,y,h.apron)||nearPolyline(x,y,h.path,25*.85))return true;
 return terrainSurfaceWalkable(x,y)&&!SLOTS.some(s=>parcelBlocked(s,x,y))&&!PERMANENT_HOMES.some(s=>parcelBlocked(s,x,y));
}
export function worldWalkableForTheme(theme,x,y,colliders=[]){
 if(!harborGeometry[theme]||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>WORLD.width||y>WORLD.height)return false;
 if(colliders.some(p=>Math.abs(x-p.x)<p.rx+9&&Math.abs(y-p.y)<p.ry+9))return false;
 const hx=Math.round(x*2),hy=Math.round(y*2);if(Math.abs(hx-x*2)>1e-7||Math.abs(hy-y*2)>1e-7)return baseWorldWalkable(theme,x,y);
 const cache=basePoints[theme],key=hy*(WORLD.width*2+1)+hx;let value=cache.get(key);if(value===undefined){value=baseWorldWalkable(theme,hx/2,hy/2);if(cache.size>=250000)cache.clear();cache.set(key,value);}return value;
}
export function worldWalkable(x,y){return worldWalkableForTheme(worldTheme,x,y,worldDisplayColliders)}
// Explicit theme keeps server-side routing independent of the active browser theme.
// Baked edges cover static terrain; moving people remain real dynamic obstacles.
export function findWorldPathForTheme(theme,start,end,avoid=[]){
 const blocked=avoid.length?(x,y)=>avoid.some(p=>Math.hypot(p.x-x,p.y-y)<15):null;
 const free=(x,y)=>worldWalkableForTheme(theme,x,y)&&(!blocked||!blocked(x,y));
 return findPath(start,end,free,CELL,terrainMovementCost,{theme,blocked});
}
export function findPath(start,end,walkable=worldWalkable,cell=CELL,movementCost=walkable===worldWalkable?terrainMovementCost:null,navigation=null){
 let sx=Math.round(start.x/cell),sy=Math.round(start.y/cell);const gx=Math.round(end.x/cell),gy=Math.round(end.y/cell);
 const key=(x,y)=>`${x},${y}`;const goal={x:gx,y:gy};
 const ok=(x,y)=>walkable(x*cell,y*cell);
 if(!ok(sx,sy)){let best=null;for(let r=1;r<=3&&!best;r++)for(let y=sy-r;y<=sy+r;y++)for(let x=sx-r;x<=sx+r;x++){if(ok(x,y)&&(!best||Math.hypot(x*cell-start.x,y*cell-start.y)<best.d))best={x,y,d:Math.hypot(x*cell-start.x,y*cell-start.y)}}if(!best)return [];sx=best.x;sy=best.y;}
 let tx=gx,ty=gy;
 if(!ok(gx,gy)){let found=false;for(let radius=1;radius<=8&&!found;radius++){for(let y=gy-radius;y<=gy+radius&&!found;y++)for(let x=gx-radius;x<=gx+radius;x++){if(ok(x,y)){tx=x;ty=y;found=true;break}}}if(!found)return []}
 const open=new PathQueue(),seen=new Map([[key(sx,sy),0]]),parent=new Map();let visited=0;open.push({x:sx,y:sy,g:0,f:0});
 while(open.length&&visited<32000){const cur=open.shift();if(cur.g>(seen.get(key(cur.x,cur.y))??Infinity))continue;visited++;if(cur.x===tx&&cur.y===ty){const path=[];let k=key(tx,ty);while(k!==key(sx,sy)){const [px,py]=k.split(',').map(Number);path.push({x:px*cell,y:py*cell});k=parent.get(k);if(!k)break}return path.reverse()}
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=cur.x+dx,y=cur.y+dy;if(!ok(x,y))continue;if(dx&&dy&&(!ok(cur.x+dx,cur.y)||!ok(cur.x,cur.y+dy)))continue;if(cell===WORLD_CELL){const edge=navigation?worldBaseEdge(navigation.theme,cur.x,cur.y,dx,dy):walkable===worldWalkable?worldBaseEdge(worldTheme,cur.x,cur.y,dx,dy):null;if(edge===false)continue;if(edge===null||(navigation?navigation.blocked:worldDisplayColliders.length||walkable!==worldWalkable)){const steps=Math.ceil(Math.hypot(dx,dy)*cell/2);let clear=true;for(let i=1;i<steps;i++){const px=(cur.x+dx*i/steps)*cell,py=(cur.y+dy*i/steps)*cell;if(edge===null?!walkable(px,py):navigation?navigation.blocked?.(px,py):worldDisplayColliders.some(p=>Math.abs(px-p.x)<p.rx+9&&Math.abs(py-p.y)<p.ry+9)){clear=false;break;}}if(!clear)continue;}}const weight=movementCost?movementCost(x*cell,y*cell):1;const g=cur.g+(dx&&dy?1.414:1)*weight;const k=key(x,y);if(g>=(seen.get(k)??Infinity))continue;seen.set(k,g);parent.set(k,key(cur.x,cur.y));open.push({x,y,g,f:g+Math.hypot(tx-x,ty-y)})}
 }
 return [];
}
export const SCENE={width:1000,height:660};
export function sceneWalkable(scene,x,y){
 if(x<70||x>930||y<165||y>600)return false;
 if(scene==='farm')return farmWalkable(worldTheme,x,y);
 if(scene==='mine'){
  for(let i=0;i<6;i++){const bx=320+(i%3)*180,by=170+Math.floor(i/3)*145;if(Math.abs(x-bx)<65&&Math.abs(y-by)<55)return false}
  return true;
 }
 if(scene==='workshop')return !(x>270&&x<710&&y>185&&y<375);
 if(scene==='tea')return !(x>175&&x<835&&y>200&&y<380);
 return !(x>220&&x<780&&y>205&&y<345);
}




