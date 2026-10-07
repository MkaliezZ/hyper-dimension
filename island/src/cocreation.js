import {RECIPE_BY_ID} from './contentCatalog.js';
export const CO_CREATION_SCHEMA='hyper-dimension.cocreation/v1';
export const CO_CREATION_LIMITS={bytes:48000,packages:24,versions:20,challenges:6,hints:6};
const bad=message=>Object.assign(Error(message),{status:400,code:'cocreation_invalid'});
const object=v=>v&&typeof v==='object'&&!Array.isArray(v),allowed=(v,keys)=>{if(!object(v)||Object.keys(v).some(k=>!keys.includes(k)))throw bad('存在未支持的字段，请使用共创模板');};
const text=(v,min,max,name)=>{if(typeof v!=='string'||v.trim().length<min||v.trim().length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw bad(name+'长度或内容不符合模板');return v.trim();};
export function validateCoCreationPack(input){
 if(new TextEncoder().encode(JSON.stringify(input)).length>CO_CREATION_LIMITS.bytes)throw bad('共创包过大');allowed(input,['schema','id','title','author','summary','license','source','themeNotes','challenges']);
 if(input.schema!==CO_CREATION_SCHEMA||!/^opc-[a-z0-9]+(?:-[a-z0-9]+){0,8}$/.test(input.id||'')||input.id.length>70)throw bad('模板版本或作品编号无效');
 const pack={schema:CO_CREATION_SCHEMA,id:input.id,title:text(input.title,2,40,'作品名称'),author:text(input.author,1,40,'作者'),summary:text(input.summary,6,320,'介绍'),license:input.license,source:text(input.source||'',0,200,'来源'),themeNotes:{}};
 if(!['CC-BY-4.0','CC0-1.0','All-Rights-Reserved'].includes(pack.license))throw bad('请选择支持的授权方式');
 if(pack.source){let u;try{u=new URL(pack.source)}catch{throw bad('来源链接需要完整http/https地址')}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw bad('来源链接无效');}
 allowed(input.themeNotes,['pixel','origami']);for(const theme of ['pixel','origami'])pack.themeNotes[theme]=text(input.themeNotes[theme],4,160,'双画风说明');
 if(!Array.isArray(input.challenges)||!input.challenges.length||input.challenges.length>CO_CREATION_LIMITS.challenges)throw bad('每个包需1–6个挑战');
 const ids=new Set();pack.challenges=input.challenges.map(c=>{allowed(c,['id','title','recipeId','seed','difficulty','minQuality','brief','hints']);if(!/^[a-z][a-z0-9-]{1,40}$/.test(c.id||'')||ids.has(c.id))throw bad('挑战编号重复或无效');ids.add(c.id);const r=RECIPE_BY_ID[c.recipeId];if(!r)throw bad('关联图纸不在岛上目录中');if(!Number.isInteger(c.seed)||c.seed<1||c.seed>0xffffffff||![1,2,3].includes(c.difficulty)||!Number.isInteger(c.minQuality)||c.minQuality<55||c.minQuality>95)throw bad('关卡种子、难度或品质目标无效');if(!Array.isArray(c.hints)||c.hints.length>CO_CREATION_LIMITS.hints)throw bad('操作提示过多');
 return{id:c.id,title:text(c.title,2,50,'挑战名称'),recipeId:r.id,seed:c.seed,difficulty:c.difficulty,minQuality:c.minQuality,brief:text(c.brief,8,400,'挑战说明'),hints:c.hints.map(v=>text(v,2,100,'操作提示'))};});
 return pack;
}
export function coCreationChallenge(pack,id){const c=pack.challenges.find(c=>c.id===id);return c?{...c,recipe:RECIPE_BY_ID[c.recipeId],building:RECIPE_BY_ID[c.recipeId].building}:null;}
export const CO_CREATION_EXAMPLES=[
 {schema:CO_CREATION_SCHEMA,id:'opc-tide-tea',title:'潮汐茶席 · 记忆练习',author:'Hyper Dimension 课程组',summary:'用茶材配对设计一个有明确目标的迎客练习，观察难度、提示与作品说明如何共同影响体验。',license:'CC-BY-4.0',source:'',themeNotes:{pixel:'复用岛上像素茶材和手账边框，让提示像一张清晰的小纸条。',origami:'复用折纸茶材与奶油色卡片，让留白和纸层保持一致。'},challenges:[{id:'welcome-tea',title:'给第一位旅人一桌暖茶',recipeId:'recipe_tea',seed:20261011,difficulty:1,minQuality:75,brief:'先观察茶材，再翻出相同的两张。完成整桌配对，品质达到75即可通过共创练习。',hints:['先记住四个角落的茶材。','翻牌失误后停一下，用位置记忆代替连续乱点。']}]},
 {schema:CO_CREATION_SCHEMA,id:'opc-patient-potter',title:'一器一形 · 陶艺共创课',author:'Hyper Dimension 课程组',summary:'把口沿、釉色分区和三段火候讲清楚，设计一份可被另一位岛主理解并完成的陶艺挑战。',license:'CC-BY-4.0',source:'',themeNotes:{pixel:'以像素陶器和清晰的分区提示记录手作过程。',origami:'以折纸陶器和温暖的工作台让形状、釉色与火候层次分明。'},challenges:[{id:'patient-vase',title:'留给晨光岛的一只花瓶',recipeId:'recipe_pottery',seed:20261005,difficulty:1,minQuality:80,brief:'先把十二段器型修到目标轮廓，按委托分区上釉，再跟随升温、保温和退火曲线。品质达到80通过。',hints:['口沿和器足也需要吻合。','刷错的釉色可以覆盖重做。','进入退火时先收火，再调风门。']}]}
];
