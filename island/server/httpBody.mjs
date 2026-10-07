// Decode only after collecting bytes; a TCP chunk can end inside a Chinese character.
export async function readJsonBody(stream,limit=90000){
 const chunks=[];let bytes=0;
 for await(const chunk of stream){const data=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=data.length;if(bytes>limit)throw Object.assign(Error('请求内容过大'),{status:413,code:'body_too_large'});chunks.push(data);}
 return JSON.parse(Buffer.concat(chunks,bytes).toString('utf8'));
}
