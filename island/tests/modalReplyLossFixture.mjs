// Declared isolated transport fixture: real commit first, then lose its HTTP reply.
import {ServerResponse} from 'node:http';import {appendFileSync} from 'node:fs';
if((process.argv[1]||'').replaceAll('\\','/').endsWith('/server.mjs')){
 const end=ServerResponse.prototype.end;let reset=0;
 ServerResponse.prototype.end=function(...args){
  let d;try{d=JSON.parse(Buffer.isBuffer(args[0])?args[0].toString():args[0]);}catch{}
  if(this.statusCode===200&&d?.receipt?.ticket?.kind==='personal'&&d.receipt.ticket.command==='use'){
   const lose=reset<Number(process.env.HD_QA_MODAL_LOSS_COUNT||1);if(lose)reset++;
   appendFileSync(process.env.HD_QA_MODAL_LOSS_PROOF,JSON.stringify({at:Date.now(),pid:process.pid,reset,replyLost:lose,requestId:d.receipt.ticket.requestId,replayed:!!d.replayed,receipt:d.receipt,documentVersion:d.document?.version,realSuccessfulResponseInterceptedAfterCommit:true})+'\n');
   if(lose){this.destroy();return this;}
  }
  return end.apply(this,args);
 };
}
