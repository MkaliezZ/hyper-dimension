import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {bufferFilm} from './filmBuffer.mjs';

const content=Buffer.alloc(32771);for(let i=0;i<content.length;i++)content[i]=i%251;
const sha256=createHash('sha256').update(content).digest('hex');
async function fixture(handler,run){
 const requests=[],server=createServer((req,res)=>{requests.push(req.headers.range);handler(req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await run('http://127.0.0.1:'+server.address().port,requests);}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
function range(req,res){const [,a,b]=/^bytes=(\d+)-(\d+)$/.exec(req.headers.range),start=Number(a),end=Number(b);
 res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${content.length}`,'Content-Length':end-start+1});res.end(content.subarray(start,end+1));}
test('four bounded ranges reconstruct the exact file with monotonic progress',()=>fixture(range,async(url,requests)=>{
 const progress=[],bytes=await bufferFilm(url,{sha256,onProgress:(n,total)=>progress.push([n,total])});
 assert.deepEqual(Buffer.from(bytes),content);assert.equal(requests.length,5);assert.equal(requests[0],'bytes=0-0');
 assert.equal(progress.at(-1)[0],content.length);assert(progress.every(([n,total],i)=>total===content.length&&(!i||n>=progress[i-1][0])));
}));
test('a server ignoring ranges uses its one complete response',()=>fixture((req,res)=>{res.writeHead(200,{'Content-Length':content.length});res.end(content);},async(url,requests)=>{
 assert.deepEqual(Buffer.from(await bufferFilm(url,{sha256})),content);assert.equal(requests.length,1);
}));
test('a mismatched content range fails without accepting corrupt bytes',()=>fixture((req,res)=>{
 if(req.headers.range==='bytes=0-0')return range(req,res);res.writeHead(206,{'Content-Range':'bytes 1-2/3'});res.end('xx');
},async url=>assert.rejects(bufferFilm(url,{sha256}),/Invalid showcase range response/)));
test('an oversized range is rejected before allocation',()=>fixture((req,res)=>{res.writeHead(206,{'Content-Range':'bytes 0-0/134217729'});res.end('x');},async url=>assert.rejects(bufferFilm(url,{sha256}),/Invalid showcase range length/)));
test('incomplete range data cannot become a prepared film',()=>fixture((req,res)=>{
 if(req.headers.range==='bytes=0-0')return range(req,res);const[,a,b]=/^bytes=(\d+)-(\d+)$/.exec(req.headers.range);res.writeHead(206,{'Content-Range':`bytes ${a}-${b}/${content.length}`});res.end('x');
},async url=>assert.rejects(bufferFilm(url,{sha256}),/Showcase range is incomplete/)));
test('a correct length with the wrong hash still fails',()=>fixture(range,async url=>assert.rejects(bufferFilm(url,{sha256:'0'.repeat(64)}),/checksum mismatch/)));
test('selection cancellation rejects the in-flight reads',()=>fixture((req,res)=>{
 if(req.headers.range==='bytes=0-0')return range(req,res);
},async url=>{const controller=new AbortController(),request=bufferFilm(url,{sha256,signal:controller.signal});setTimeout(()=>controller.abort(),30);await assert.rejects(request,error=>error.name==='AbortError');}));
