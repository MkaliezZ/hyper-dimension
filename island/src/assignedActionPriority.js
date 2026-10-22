const assigned=id=>typeof id==='string'&&id.length>0&&id.length<=240;
const npc=(actor,id)=>actor==='npc'&&Number.isSafeInteger(id)&&id>=0&&id<=16;
// This selects a queue turn, never execution permission. The server still
// validates the assignment, version, resources and accepted lease. The existing
// queue alternates promoted work with FIFO work and preserves checkpoint barriers.
export function assignedActionForeground(input,actions){
 if(!input||!['resident','field','farm'].includes(input.kind))return false;
 if(input.operation==='begin'){
  if(input.kind==='resident')return npc(input.actor===undefined?'npc':input.actor,input.actorId)&&!!input.intent&&!Array.isArray(input.intent)&&assigned(input.intent.assignmentId);
  return npc(input.actor,input.actorId)&&assigned(input.assignmentId);
 }
 if(!['finish','cancel'].includes(input.operation)||typeof input.requestId!=='string'||typeof input.epoch!=='string'||!input.epoch||!Number.isSafeInteger(input.sequence)||input.sequence<=0)return false;
 const leases=actions?.[input.kind]?.leases;
 if(!leases||!Object.hasOwn(leases,input.requestId))return false;
 const ticket=leases[input.requestId];
 return ticket?.kind===input.kind&&npc(ticket.actor,ticket.actorId)&&ticket.requestId===input.requestId&&ticket.epoch===input.epoch&&ticket.sequence===input.sequence&&assigned(ticket.assignmentId);
}
