const stages={hoe:0,sow:1,water:2,harvest:4};

// An intent can wait behind another action or a clock save. Check the newly
// acknowledged plot before journaling a NEW command; pending commands keep
// their original identity and must still be replayed to discover their outcome.
export function assertCurrentFarmIntent(actions,input){
 if(input.kind!=='farm'||input.operation!=='begin'||input.actor&&!['player','npc'].includes(input.actor)||!actions?.farm||!Object.hasOwn(stages,input.step))return;
 const plot=actions.farm.plots?.[input.index];
 if(plot?.stage===stages[input.step]&&(plot.stage<2||input.crop===undefined||plot.crop===input.crop))return;
 const message=plot?.stage===3?(input.step==='water'?'这块田已完成浇水，作物正在生长':'作物还在生长，请成熟后收获'):'田地进度已变化，请重新选择农活';
 throw Object.assign(Error(message),{code:'farm_intent_changed'});
}
