import {createHash} from 'node:crypto';
import {hydrateResources,releaseResources} from '../src/resourceLedger.js';
import {sameState} from '../src/actionMerge.js';
const fail=(text,code='resource_state_conflict')=>Object.assign(Error(text),{status:409,code});
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])):v;
const fingerprint=s=>createHash('sha256').update(JSON.stringify(canonical(s.resourceLedger??null))).digest('hex');
const mirror=()=>({version:1,enabled:true});
export const validResourceBook=b=>b===undefined||b?.version===1&&/^[a-f0-9]{64}$/.test(b.fingerprint);
export function syncResourceState(s,b){if(!b?.resources)return;s.resourceControl=mirror();b.resources.fingerprint=fingerprint(s);}
export function assertResourceState(s,b){if(b?.resources&&(!sameState(s.resourceControl,mirror())||fingerprint(s)!==b.resources.fingerprint))throw fail('物资交易、占用与历史由服务端确认，请读取已保存的物资记录。');}
export function assertResourceJournal(s,old,b){if(!b?.personal||b.resources)return;for(const key of ['receipts','events'])if(!sameState(s.resourceLedger?.[key]??(key==='receipts'?{}:[]),old.resourceLedger?.[key]??(key==='receipts'?{}:[])))throw fail('已确认物资收据和历史不能由浏览器改写，请读取服务端进度。');}
export function enableResourceState(s,b){if(!b.resources){hydrateResources(s);for(const owner of Object.keys(s.resourceLedger.reservations))if(owner.startsWith('player-tool:'))releaseResources(s,owner);b.resources={version:1,fingerprint:''};syncResourceState(s,b);}}
export function clearResourceState(s){delete s.resourceControl;}
