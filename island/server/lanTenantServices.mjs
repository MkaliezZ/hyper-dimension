import {resolve,sep} from 'node:path';import {createSaveStore} from './saveStore.mjs';import {createCoCreationStore} from './cocreationStore.mjs';import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';import {legacySaveKey} from '../src/saveStorage.js';
const fail=(message,code,status=400)=>Object.assign(Error(message),{code,status});
export function createLanTenantServices({directory,identities,now=()=>Date.now(),externalFault=()=>{}}){
 const root=resolve(directory,'_lan','islands'),services=new Map();
 async function get(token){const account=await identities.authorize(token);if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(account.id))throw fail('岛主身份无效','lan_identity',401);let context=services.get(account.id);
 if(!context){const path=resolve(root,account.id);if(!path.startsWith(root+sep))throw fail('岛屿目录无效','lan_identity',401);const saves=createSaveStore({directory:path,now,externalEconomy:true,externalFault}),cocreation=createCoCreationStore({directory:path,now,worldExists:async(theme,key)=>{const d=await saves.current(theme);return!!d&&key===d.state.saveSlot;}});
 const guarded={...saves};for(const method of ['open','openClient','save','action','restore','restoreClient','import','previewImport','importClient','restart','restartClient','queueCrossTask'])guarded[method]=(theme,...args)=>identities.withHomeIsland(account.id,theme,()=>saves[method](theme,...args));context={accountId:account.id,directory:path,saves:guarded,cocreation};services.set(account.id,context);}
 return{...context,account};
 }
 async function open(token,theme,{clientId=''}={}){if(!['pixel','origami'].includes(theme))throw fail('画风无效','lan_invalid');const c=await get(token),p=c.account.profile,state=hydrateTown(createZeroState({playerProfile:{name:p.name,islandName:p.islandName,avatar:p.avatar}}));state.saveSlot=legacySaveKey(theme)+'-restart-'+c.accountId;return c.saves.open(theme,{legacyState:state,clientId:String(clientId).slice(0,80),protect:true});}
 return{root,get,open,
 async externalTransactionForServer(accountId,theme,input){if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(accountId)||!['pixel','origami'].includes(theme))throw fail('岛屿身份无效','lan_identity');return createSaveStore({directory:resolve(root,accountId),now,externalEconomy:true,externalFault}).externalTransaction(theme,input);},
 async awardWonderForServer(accountId,theme,input){if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(accountId)||!['pixel','origami'].includes(theme))throw fail('岛屿身份无效','lan_identity');return createSaveStore({directory:resolve(root,accountId),now,externalEconomy:true,externalFault}).externalWonder(theme,input);},
 async readIslandForServer(accountId,theme){if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(accountId)||!['pixel','origami'].includes(theme))throw fail('岛屿身份无效','lan_identity');return createSaveStore({directory:resolve(root,accountId),now,externalEconomy:true,externalFault}).current(theme);}
 };
}
