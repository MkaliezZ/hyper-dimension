import {createOwnerRuntime} from './lanAgentService.mjs';
import {createPartyProposalStore} from './partyProposalStore.mjs';
const localMethods=new Set(['plans','conversations','residentChatHistory','residentChatSend']);
export function deviceAwareRuntimeFactory(bridge,localFactory=createOwnerRuntime){
 return context=>{
  const local=localFactory(context),proof=createPartyProposalStore({directory:context.islandDirectory||context.directory});
  const runtime={
   get documents(){return bridge.descriptor(context.ownerId)?.workspace||local.documents;},
   async bridge(){const d=await bridge.bound(context.ownerId);return {available:true,bound:!!d,online:d?.online||false,device:d};},
   async call(method,args={}){
    const bound=await bridge.bound(context.ownerId);
    if(!bound||localMethods.has(method))return local.call(method,args);
    if(method==='status'){const server=await local.call('status',{}),remote=await bridge.runtimeStatus(context.ownerId);return {...server,hermes:remote.hermes,deviceBridge:remote.deviceBridge,automaticRequests:{...server.automaticRequests,steward:remote.automaticRequests?.steward}};}
    if(method==='policy'){
     const result=await bridge.call(context.ownerId,method,args);
     await local.call(method,args);return result;
    }
    const result=await bridge.call(context.ownerId,method,args);
    if(method==='command'&&result.source==='hermes'&&result.parties?.length)await proof.record({theme:args.theme,worldKey:args.saveSlot,runId:result.runId,parties:result.parties});
    if(result&&typeof result==='object')result.runtimeLocation={type:'original-device',deviceId:bound.id,name:bound.name};
    return result;
   },
   async recoverRequest(id){const receipt=await bridge.recoverRequest(context.ownerId,id);if(receipt?.phase==='completed'&&receipt.result?.source==='hermes'&&receipt.result.parties?.length)await proof.record({theme:receipt.theme,worldKey:receipt.worldKey,runId:receipt.result.runId,parties:receipt.result.parties});return receipt;},
   close:()=>local.close()
  };return runtime;
 };
}
