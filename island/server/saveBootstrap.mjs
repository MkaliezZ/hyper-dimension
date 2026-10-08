import {enableResourceState} from './resourceAuthority.mjs';
import {randomUUID} from 'node:crypto';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {legacySaveKey} from '../src/saveStorage.js';
import {AVATAR_BY_ID} from '../src/avatarCatalog.js';
import {newActionBook,applyGatherCommand} from './playerActions.mjs';
import {enableField} from './fieldActions.mjs';
import {enableResident} from './residentActions.mjs';
import {enablePlanningState} from './planningAuthority.mjs';
import {syncPersonalState} from './personalActions.mjs';
export function initialIdentity(source){
 const profile={},p=source?.playerProfile;
 for(const [key,max]of Object.entries({name:24,islandName:24,bio:200,birthday:16,pronouns:24})){if(typeof p?.[key]==='string')profile[key]=p[key].slice(0,max);}
 if(Object.hasOwn(AVATAR_BY_ID,p?.avatar||''))profile.avatar=p.avatar;
 const identity={playerProfile:profile};
 if(Object.hasOwn(AVATAR_BY_ID,source?.butlerAvatar||''))identity.butlerAvatar=source.butlerAvatar;
 return identity;
}
export function hasLegacyProgress(s){
 if(!s||typeof s!=='object'||Array.isArray(s))return false;
 if(s.day>1||s.coins>0||s.activities>0)return true;
 if(Object.values(s.inventory||{}).some(n=>Number.isFinite(n)&&n>0))return true;
 for(const key of ['discovered','craftHistory','placedItems','npcProfiles','npcAffinity','npcMemory','workProjects','agentTaskLedger'])if(s[key]&&Object.keys(s[key]).length)return true;
 return false;
}
export function serverZeroState(theme,identity={}){
 const s=hydrateTown(createZeroState(initialIdentity(identity)));
 s.saveSlot=legacySaveKey(theme)+'-restart-'+randomUUID();return s;
}
export function bootstrapSaveAuthority(s,theme,now){
 hydrateTown(s);const b=newActionBook(),commands=[
  ['farm','enable'],['visitor','enable'],['commerce','enable'],['facility','enable'],
  ['commerce','party_enable'],['commerce','night_enable'],['commerce','fish_enable'],
  ['commerce','festival_enable'],['commerce','couture_enable'],['commerce','fireworks_enable'],['commerce','hire_enable'],
 ];
 for(const [kind,operation]of commands)applyGatherCommand(s,b,{kind,operation,theme,appearance:s.worldAppearance||theme,day:s.day,requestId:randomUUID()},now);
 enableField(s,b,now);enableResident(s,b);enablePlanningState(s,b);
 applyGatherCommand(s,b,{kind:'personal',operation:'enable',theme,day:s.day,requestId:randomUUID()},now);syncPersonalState(s,b);enableResourceState(s,b);return b;
}
