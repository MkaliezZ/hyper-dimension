// Reuse unchanged label metrics and dialogue wrapping, while leaving glyph
// drawing on the original Canvas at its original coordinates and resolution.
export function createMapTextLayout(measure,{labelLimit=256,speechLimit=128}={}){
 if(typeof measure!=='function'||!Number.isInteger(labelLimit)||labelLimit<1||!Number.isInteger(speechLimit)||speechLimit<1)throw TypeError('Invalid map text cache');
 const labels=new Map(),dialogue=new Map();let measurements=0,hits=0;
 function cached(cache,key,limit,build){
  if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);hits++;return value;}
  const value=build();cache.set(key,value);if(cache.size>limit)cache.delete(cache.keys().next().value);return value;
 }
 function width(text,font){measurements++;return measure(text,font);}
 return{
  label(text,font){return cached(labels,JSON.stringify([font,text]),labelLimit,()=>width(text,font));},
  speech(text,font,maxWidth){
   if(!Number.isFinite(maxWidth)||maxWidth<=0)throw TypeError('Invalid dialogue width');
   return cached(dialogue,JSON.stringify([font,maxWidth,text]),speechLimit,()=>{
    const rows=[];let row='';for(const ch of text){if(row&&width(row+ch,font)>maxWidth){rows.push(row);row='';}row+=ch;}if(row)rows.push(row);return Object.freeze(rows);
   });
  },
  clear(){labels.clear();dialogue.clear();},
  inspect:()=>({labels:labels.size,dialogue:dialogue.size,labelLimit,speechLimit,measurements,hits})
 };
}
