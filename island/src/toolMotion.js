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
