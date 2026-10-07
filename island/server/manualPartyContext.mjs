import {partyPlanningContext,partyPlanningContexts} from '../src/partyPlanning.js';
export function manualPartyContext(state,theme,{saveSlot,visiting=false}={}){
 if(!state)return{party:null,partyTemplates:{}};
 const key=state.saveSlot||'legacy-'+theme;
 if(saveSlot&&saveSlot!==key)throw Object.assign(Error('原岛档案已变化，请重新打开管家'),{code:'party_world_changed',status:409});
 return{saveSlot:key,party:visiting?null:partyPlanningContext(state),partyTemplates:visiting?{}:partyPlanningContexts(state)};
}
