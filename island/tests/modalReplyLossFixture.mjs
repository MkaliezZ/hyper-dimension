// Declared isolated transport fixture: real commit first, then lose its HTTP reply.
import {Server,ServerResponse} from 'node:http';import {appendFileSync} from 'node:fs';
if((process.argv[1]||'').replaceAll('\\','/').endsWith('/server.mjs')){
 const trace=record=>{try{appendFileSync(process.env.HD_QA_MODAL_LOSS_PROOF+'-requests.jsonl',JSON.stringify({at:Date.now(),pid:process.pid,...record})+'\n');}catch{process.stderr.write('Isolated transport trace unavailable\n');}};
 // Observe arrival/completion without reading the body,changing socket policy,
 // catching server failures,or adding a clientError/error handler.
 const emit=Server.prototype.emit;let sequence=0;
 Server.prototype.emit=function(event,...args){
  if(event==='request'){
   const [request,response]=args,path=new URL(request.url,'http://isolated').pathname;
   if(request.method==='POST'&&/^\/api\/saves\/(pixel|origami)\/action$/.test(path)){
    const id=++sequence;trace({phase:'request',id,path,connection:request.headers.connection||null,contentLength:request.headers['content-length']||null,remotePort:request.socket.remotePort});
    request.once('end',()=>trace({phase:'request-end',id,complete:request.complete,aborted:request.aborted}));
    response.once('finish',()=>trace({phase:'response-finish',id,status:response.statusCode,finished:response.writableFinished}));
    response.once('close',()=>trace({phase:'response-close',id,status:response.statusCode,headersSent:response.headersSent,finished:response.writableFinished}));
   }
  }
  return emit.call(this,event,...args);
 };
 process.on('uncaughtExceptionMonitor',(error,origin)=>trace({phase:'uncaught-monitor',origin,code:error.code||null,message:String(error.message).slice(0,1000)}));
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
