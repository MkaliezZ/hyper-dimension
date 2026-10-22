import {createServer} from 'node:http';
export function createDrainingHttpServer(handler){
 const sockets=new Set(),active=new Map(),accepted=new Set();let draining=false,closing;
 function endIdle(socket){if(draining&&!active.get(socket)&&!socket.destroyed&&!socket.writableEnded)socket.end();}
 const server=createServer(async(req,res)=>{
  const socket=req.socket;active.set(socket,(active.get(socket)||0)+1);
  if(draining)res.setHeader('Connection','close');
  let responded=false,handled=false,settled=false;
  function settle(){
   if(settled||!responded||!handled)return;settled=true;
   if(socket.destroyed)active.delete(socket);else active.set(socket,Math.max(0,(active.get(socket)||0)-1));endIdle(socket);
  }
  const responseDone=()=>{responded=true;settle();};res.once('finish',responseDone);res.once('close',responseDone);
  const task=(async()=>handler(req,res))();accepted.add(task);
  try{await task;}finally{accepted.delete(task);handled=true;settle();}
 });
 server.on('connection',socket=>{sockets.add(socket);active.set(socket,0);socket.once('close',()=>{sockets.delete(socket);active.delete(socket);});});
 function close(){
  if(closing)return closing;draining=true;
  const stopped=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  // A lost client response does not cancel an already accepted save or command.
  // Its handler must finish before the caller releases the data directory lease.
  closing=(async()=>{await stopped;await Promise.allSettled([...accepted]);})();
  for(const socket of sockets)endIdle(socket);server.closeIdleConnections();return closing;
 }
 return {server,close};
}
