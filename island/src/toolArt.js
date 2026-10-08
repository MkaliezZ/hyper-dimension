// Normalized anchors refer to each theme's trimmed item frame. The two pickaxes
// have opposite handle directions, so a shared lower-left grip is incorrect.
export const TOOL_ART={
 pixel:{
  hoe:{file:'tool-hoe-pixel-v119.png',width:1254,height:1254,frame:{x:164,y:194,w:1055,h:962},grip:[88/1055,841/962],tip:[926/1055,279/962]},
  pickaxe:{grip:[.24,.79],tip:[.53,.13]},
  axe:{grip:[.21,.78],tip:[.67,.22]},
  sickle:{grip:[.40,.80],tip:[.56,.05]},
  watering_can:{grip:[.59,.11],tip:[.08,.30],align:false},
  rod:{grip:[.15,.78],tip:[.98,.07]},
  c16_9:{grip:[.15,.83],tip:[.96,.03]}
 },
 origami:{
  hoe:{file:'tool-hoe-origami-v119.png',width:1254,height:1254,frame:{x:130,y:164,w:1095,h:981},grip:[110/1095,871/981],tip:[953/1095,314/981]},
  pickaxe:{grip:[.79,.79],tip:[.47,.13]},
  axe:{grip:[.21,.78],tip:[.64,.23]},
  sickle:{grip:[.31,.78],tip:[.56,.05]},
  watering_can:{grip:[.64,.18],tip:[.06,.32],align:false},
  rod:{grip:[.15,.83],tip:[.96,.03]},
  c16_9:{grip:[.145,.844],tip:[.97,.03]}
 }
};
export function heldToolGeometry(id,theme,frame,size,angle=0){
 const spec=TOOL_ART[theme]?.[id];if(!spec||!frame||!(frame.w>0&&frame.h>0&&size>0))return null;
 const scale=size/Math.max(frame.w,frame.h),w=frame.w*scale,h=frame.h*scale;
 const dx=(spec.tip[0]-spec.grip[0])*w,dy=(spec.tip[1]-spec.grip[1])*h;
 const rotation=spec.align===false?angle:angle-Math.atan2(dy,dx),cos=Math.cos(rotation),sin=Math.sin(rotation);
 return {grip:{x:spec.grip[0],y:spec.grip[1]},rotation,width:w,height:h,
  tip:{x:dx*cos-dy*sin,y:dx*sin+dy*cos},shaftLength:Math.hypot(dx,dy)};
}
