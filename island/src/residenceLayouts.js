// Coordinates are calibrated against each home's own 1536 x 1024 painting.
// Style variants share the physical plan, but different owners never share a plan.
const point=(x,y)=>({x,y});
const zone=(id,name,rect,entry,description,kind='note')=>({id,name,rect,entry,description,kind});
export const RESIDENCE_LAYOUTS={
  0:{id:0,revision:191,name:'麦穗小舍',intro:'留种、育苗、记录。阿岚把耐心放进了家里的每一处角落。',
    image:theme=>'/assets/residences-v191/wheat-'+theme+'.png',entry:point(500,580),
    floor:[[60,228],[926,228],[942,550],[625,550],[625,625],[375,625],[375,550],[55,550]],
    obstacles:[[55,220,295,90],[15,305,335,207],[712,220,225,91],[715,312,255,230]],
    lamps:[[308,145],[914,332]],bed:point(210,202),
    zones:[
      zone('nursery','育苗台',[25,310,270,195],point(370,385),'四种适季作物，安排进十六个育苗格。同一行、列和四格小区都不重复。','activity'),
      zone('seeds','留种柜',[630,72,115,145],point(675,260),'种子按季节收好。今天的种苗排列完成后，会留下一页育苗手账。','record'),
      zone('diary','田间日记',[780,320,195,200],point(690,405),'先看看真实的田地：哪些缺水、哪些成熟，再安排下一次播种。','farm'),
      zone('breakfast','窗边小桌',[730,175,190,125],point(675,325),'一杯热茶、一片面包。忙起来也要留出认真吃饭的时间。'),
      zone('bed','亚麻床铺',[110,120,180,170],point(360,300),'把北方带来的种子安顿好以后，阿岚才愿意睡个好觉。','bed')
    ]},
  1:{id:1,revision:191,name:'木榫居',intro:'修好的旧物比新买的更值得留下。小墨的家沿着一张长工作台展开。',
    image:theme=>'/assets/residences-v191/joinery-'+theme+'.png',entry:point(805,580),
    floor:[[233,210],[430,210],[480,230],[680,230],[900,325],[910,625],[735,625],[735,580],[72,580],[72,330]],
    obstacles:[[55,300,180,180],[55,475,280,110],[425,283,62,100],[675,325,38,300],[600,422,78,160]],
    solidPolygons:[[[705,220],[890,283],[895,331],[790,310],[710,268]],[[315,230],[435,232],[428,495],[266,488]]],
    lamps:[[184,114],[793,157],[874,371]],bed:point(300,148),
    zones:[
      zone('repair','木片工作台',[275,220,160,267],point(515,435),'把八块木片沿空位滑动，还原一幅家的拼画。木纹与画面会帮你辨认接缝。','activity'),
      zone('keepsakes','旧物陈列',[85,255,150,180],point(255,400),'木马、航船与旧时钟都经过修缮。完成的拼画记录也留在这里。','record'),
      zone('sketch','窗边设计桌',[715,170,170,135],point(650,270),'小墨会先核对材料和连接方式，再动手。这里可以查看岛上已解锁的木工作品。','recipes'),
      zone('tools','工具墙',[480,75,160,145],point(560,250),'手刨、木槌、锯子各有位置。归位以后，下次修理才不必从找工具开始。'),
      zone('bed','帘后的床',[230,92,150,110],point(255,245),'修缮声停下来，拉上帘子，这里就是小墨安静的休息角。','bed')
    ]}
};

export function insideHomePolygon(points,x,y){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [ax,ay]=points[i],[bx,by]=points[j];
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
}
export function homeWalkable(layout,x,y){
  return insideHomePolygon(layout.floor,x,y)&&!layout.obstacles.some(([a,b,w,h])=>x>a-7&&x<a+w+7&&y>b-7&&y<b+h+7)&&!(layout.solidPolygons||[]).some(p=>insideHomePolygon(p,x,y));
}
export function homeZoneAt(layout,x,y){return layout.zones.find(z=>{const[a,b,w,h]=z.rect;return x>=a&&x<=a+w&&y>=b&&y<=b+h;})||null;}
