const fract=n=>n-Math.floor(n);
const hash=n=>fract(Math.sin(n*127.1+311.7)*43758.5453);
// World anchored and sampled from time: camera motion and dropped frames never restart rain.
export function rainParticle(index,time,width,height){
 const phase=fract(time/(1.05+hash(index+41)*.5)+hash(index+17));
 const groundX=hash(index+703)*width,groundY=hash(index+941)*height;
 if(phase<.78){const progress=phase/.78;return {kind:'drop',x:groundX-(1-progress)*18,y:groundY-(1-progress)*100,length:12+hash(index+53)*8,alpha:.4+hash(index+73)*.22};}
 const progress=(phase-.78)/.22;
 return {kind:'splash',x:groundX,y:groundY,radius:1+progress*3.5,alpha:(1-progress)*.3};
}
export function weatherParticleBudget(environment){
 return {rain:environment?.weather?.id==='rain'?480:0,snow:environment?.weather?.id==='snow'?260:0};
}
