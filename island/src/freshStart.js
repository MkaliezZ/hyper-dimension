import {initializeZeroProgress} from './freshState.js';
import {createState} from './world.js';
import {hydrateNpcProfileAudit} from './npcProfileAudit.js';

// Keep identity choices; all earned progress is rebuilt from a fresh state.
export function createZeroState(previous={}){
 const state=initializeZeroProgress(createState());
 state.playerProfile={};
 for(const key of ['name','islandName','bio','birthday','pronouns','avatar']){
  const value=previous.playerProfile?.[key];
  if(typeof value==='string')state.playerProfile[key]=value;
 }
 if(typeof previous.butlerAvatar==='string')state.butlerAvatar=previous.butlerAvatar;
 state.npcProfiles=structuredClone(previous.npcProfiles||{});
 state.npcProfileAudit=structuredClone(previous.npcProfileAudit||{});hydrateNpcProfileAudit(state);
 state.events=['第 1 天：背包与岛币从零开始，亲手采集、制作，写下新的岛屿故事。'];
 return state;
}
