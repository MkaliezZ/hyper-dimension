// A hoe digs at ground contact; the same normalized stroke drives player and NPC art.
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*smooth(t);
export function hoeStroke(progress,handY=-34,reach=52,contactAngle=null){
 const t=Math.max(0,Math.min(1,progress)),rest=-.65,raised=-1.18;
 const contact=contactAngle??Math.asin(Math.max(.1,Math.min(.95,-handY/Math.max(1,reach))));
 const angle=t<.27?mix(rest,raised,t/.27):t<.52?mix(raised,contact,(t-.27)/.25):t<.62?contact:mix(contact,rest,(t-.62)/.38);
 return {angle,contact:t>=.52&&t<=.62,soil:t>=.52&&t<.86?(t-.52)/.34:null};
}

// Project work into the ground plane. North-facing tools reach into the plot,
// while lateral strokes retain their full length; only the tool is foreshortened.
export const HOE_GROUND_POINTS=[[32,24],[-47,15],[-65,-6],[-43,-58],[42,-57],[43,-58],[65,-6],[47,15]];
export function hoeToolPose(progress,heading,hand,bob,reach,size=54){
 const [x,y]=HOE_GROUND_POINTS[heading],mirror=[1,2,3].includes(heading)?-1:1;
 const ground={x:(x-hand.x)*mirror,y:y-hand.y+bob},distance=Math.hypot(ground.x,ground.y),angle=Math.atan2(ground.y,ground.x);
 const stroke=hoeStroke(progress,hand.y-bob,reach,angle),t=Math.max(0,Math.min(1,progress));
 const depth=t<.27?0:t<.52?smooth((t-.27)/.25):t<.62?1:1-smooth((t-.62)/.38);
 return {...stroke,size:size*(1+(distance/reach-1)*depth),ground,worldGround:{x,y}};
}
// Root crops loosen first, then hands grasp and lift. Fruit and leaves never swing a sickle.
export function harvestStroke(progress,mode='cut'){
 const t=Math.max(0,Math.min(1,progress)),bend=mode==='pick'?Math.sin(t*Math.PI)*.3:Math.sin(t*Math.PI)*.85;
 const finish=pose=>({...pose,progress:t,cropOpacity:pose.showCrop?smooth((t-(mode==='cut'?.7:mode==='root'?.61:.5))/.045)*(1-smooth((t-.87)/.13)):0});
 if(mode==='root'){
  const lift=smooth((t-.56)/.26);
  return finish({mode,phase:t<.42?'loosen':t<.56?'grasp':t<.85?'lift':'stow',bend,reach:14*smooth((t-.42)/.1)*(1-lift),lift,showTool:t<.42,showCrop:t>=.61,toolProgress:Math.min(1,t/.42),cropAngle:-.14*(1-lift),soil:t>=.49&&t<.78?(t-.49)/.29:null});
 }
 if(mode==='cut')return finish({mode,phase:t<.57?'cut':'gather',bend,reach:Math.sin(t*Math.PI)*5,lift:smooth((t-.57)/.3),showTool:t<.67,showCrop:t>=.7,toolProgress:t,toolAngle:-.75+smooth(t/.55)*1.25,cropAngle:.08,soil:null});
 const lift=smooth((t-.45)/.38),low=mode==='leaf'||mode==='lift';
 return finish({mode,phase:t<.25?'reach':t<.48?'grasp':t<.85?'lift':'stow',bend,reach:(low?17:5)*Math.sin(t*Math.PI)*(1-lift*.6),lift,showTool:false,showCrop:t>=.5,cropAngle:(1-lift)*(low?-.18:.12),soil:low&&t>.5&&t<.78?(t-.5)/.28:null});
}
// Sleeve, palm and prop share one displacement; feet and body width remain stable.
export const harvestArmOffset=pose=>pose?(pose.reach*.28-pose.lift*4)*(1-smooth((pose.progress-.85)/.15)):0;
