import {DEFAULT_RECIPES,ALL_RECIPES,ITEM_BY_ID} from '../src/contentCatalog.js';
export function providerFailure(message){
 const text=String(message||'');
 if(/402|billing|credits exhausted|余额不足/i.test(text))return {code:'provider_balance',text:'DeepSeek 返回 HTTP 402，模型账户余额不足。',cooldown:300};
 if(/401|unauthorized|验证失败/i.test(text))return {code:'provider_auth',text:'模型密钥验证失败，请检查本机配置。',cooldown:300};
 return {code:'provider_unavailable',text:'Hermes 模型服务暂时不可用。',cooldown:30};
}
export function localSteward(world,message,failure){
 const request=String(message||''),stock=world.inventory||{},open=new Set((world.built||[]).map(b=>b.id));
 const keywords=['派对','夜集','灯笼','准备'];
 const requested=ALL_RECIPES.find(r=>request.includes(r.name))|| (keywords.some(k=>request.includes(k))?DEFAULT_RECIPES[0]:null);
 const recipe=requested&&open.has(requested.building)&&world.recipes?.some(r=>r.id===requested.id)?requested:null;
 let lines=[failure.text,'当前为本地管家手账，未调用模型、未派发新任务。','第 '+world.day+' 天 · 已开放 '+open.size+' 座建筑 · 访客 '+world.economy.arrivals+' 位。'];
 if(recipe){
  lines.push('准备建议：'+recipe.name+'需要 '+Object.entries(recipe.cost).map(([id,n])=>ITEM_BY_ID[id].name+' ×'+n+'（库存 '+(stock[id]||0)+'）').join('、')+'。');
  const missing=Object.entries(recipe.cost).filter(([id,n])=>(stock[id]||0)<n);
  if(missing.length)lines.push('先收集：'+missing.map(([id,n])=>ITEM_BY_ID[id].name+' ×'+(n-(stock[id]||0))).join('、')+'；再到对应建筑工作台制作。');
  else lines.push('材料已齐，可以进入对应建筑工作台制作；完成操作后才会获得成品。');
 }else lines.push('现有物资：'+['wood','ore','wheat','seed','lantern'].map(id=>ITEM_BY_ID[id].name+' '+(stock[id]||0)).join(' · ')+'。可在配方图鉴查看实际材料和解锁条件。');
 lines.push('模型恢复后可点「重试模型」重新连接。');
 return {answer:lines.join('\n'),commands:[],source:'local',tools:[],errorCode:failure.code,providerError:failure.text,retryAfter:failure.cooldown};
}
