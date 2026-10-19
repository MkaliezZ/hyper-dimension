const sources=new WeakMap();
export function registerSpriteSource(image,source){if(source)sources.set(image,source);}
export function spriteSource(image){
 const known=sources.get(image);if(known)return known;
 const value=image.currentSrc||image.src;if(!value||typeof location==='undefined')return null;
 try{const url=new URL(value,location.href);if(url.origin!==location.origin||!/^https?:$/.test(url.protocol))return null;return {kind:'original',url:url.href};}catch{return null;}
}
