import {FACILITY_ART_FRAMES,FACILITY_CUP_ART} from './facilityArtFrames.js';
// Every tea stove owns the same three permanent cups. No cups are baked into the bases.
// Atlas-space foot contacts were visually fitted to each shelf. Sorted back to front.
const TEA_CONTACTS={
 pixel:[[[273,1013],[317,1029],[274,1045]],[[562,1037],[510,1040],[542,1067]],[[650,1008],[697,1030],[656,1046]],[[979,1025],[1025,1038],[983,1060]]],
 origami:[[[259,1043],[292,1053],[260,1080]],[[510,1044],[558,1056],[522,1080]],[[665,1027],[703,1046],[665,1063]],[[960,1044],[1003,1055],[978,1075]]]
};
export function teaCupLayout(theme,rotation=0,servings=0){
 const f=FACILITY_ART_FRAMES[theme].rows[2][rotation],cup=FACILITY_CUP_ART[theme],height=theme==='pixel'?38:40,width=height*cup.frame.w/cup.frame.h;
 const count=Math.max(0,Math.min(3,Math.floor(servings)||0));
 return TEA_CONTACTS[theme][rotation].map(([x,y],index)=>({index,x:x-f.x-width/2,y:y-f.y-height,w:width,h:height,filled:index<count,foot:{x:x-f.x,y:y-f.y},liquid:{x:x-f.x,y:y-f.y-height*.68,rx:width*.34,ry:height*.08}}));
}
export const TEA_MODEL={cups:3,handle:'one side C handle opposite one open spout',shelf:'one attached wooden shelf',views:['front','right','back','left']};
export function teaEffectAnchors(theme,rotation){
 const f=FACILITY_ART_FRAMES[theme].rows[2][rotation],centers=theme==='pixel'?[[166,1092],[407,1097],null,[1169,1103]]:[[137,1101],[383,1082],null,[1137,1111]];
 const at=centers[rotation],lid=theme==='pixel'?[[167,884],[486,882],[790,884],[1110,884]][rotation]:[[163,906],[468,906],[797,908],[1120,909]][rotation];
 return {fire:at?{x:at[0]-f.x,y:at[1]-f.y}:null,steam:{x:lid[0]-f.x,y:lid[1]-f.y}};
}
