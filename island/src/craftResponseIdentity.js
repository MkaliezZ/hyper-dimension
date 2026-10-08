// A global save journal carries player and NPC jobs; each controller owns only its own request.
export function assertCraftResponse(input,response,kind){
 const ticket=response?.receipt?.ticket||response?.ticket;
 if(input?.kind!==kind||!ticket||ticket.kind!==kind||ticket.requestId!==input.requestId){
  throw Object.assign(Error('收到的作业回执与本次操作不一致，进度已保留，请重新核对。'),{code:'action_receipt_mismatch'});
 }
 return response;
}
