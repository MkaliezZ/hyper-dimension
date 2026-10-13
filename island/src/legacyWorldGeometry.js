// Frozen V168 geometry exists only for validating historical checksummed saves.
import {PARCELS,BUILDING_ORDER} from './layouts.js';
import {portfolioWalkable,portfolioBlocked,portfolioCoastBlocked} from './legacyPortfolioGeometry.js';
const slotsByTheme=Object.fromEntries(['pixel','origami'].map(theme=>[theme,PARCELS[theme].map((p,i)=>({id:BUILDING_ORDER[i],...p,entry:{x:p.x,y:p.y+p.h/2+20}}))]));
export function worldSlots(theme){return slotsByTheme[theme]||[];}
export const HARBOR_LAYOUTS={
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
export function pointInPolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside}return inside}
export function nearPolyline(x,y,path,width){for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)||0));if(Math.hypot(x-a.x-dx*t,y-a.y-dy*t)<=width)return true}return false}
const geometry=Object.fromEntries(['pixel','origami'].map(theme=>[theme,{path:HARBOR_LAYOUTS[theme].path.map(([x,y])=>({x,y})),apron:HARBOR_LAYOUTS[theme].apron.map(([x,y])=>({x,y}))}]));
export function worldWalkableForTheme(theme,x,y,colliders=[]){
 if(!geometry[theme]||!Number.isFinite(x)||!Number.isFinite(y)||portfolioBlocked(x,y))return false;
 if(colliders.some(p=>Math.abs(x-p.x)<p.rx+9&&Math.abs(y-p.y)<p.ry+9))return false;
 if(portfolioWalkable(x,y,theme))return true;if(portfolioCoastBlocked(theme,x,y))return false;
 const h=geometry[theme];if(pointInPolygon(x,y,h.apron)||nearPolyline(x,y,h.path,25))return true;
 const nx=(x-768)/737,ny=(y-490)/435;if(!(nx*nx+ny*ny<1.08&&y<850&&x>60&&x<1450)||x>1122&&y>805||x>1190&&x<1420&&y<270||x<405&&y>590&&y<812)return false;
 return !slotsByTheme[theme].some(s=>Math.abs(x-s.x)<s.w/2+4&&Math.abs(y-s.y)<s.h/2+4);
}
