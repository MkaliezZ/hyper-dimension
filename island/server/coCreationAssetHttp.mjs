// Called only after the parent server has applied its local-origin/session guard.
export async function serveCoCreationAssets({req,res,pathname,assets,readJSON,sendJSON}){
 const route=pathname.match(/^\/api\/cocreation\/(pixel|origami)\/art(?:\/([a-f0-9]{64}))?$/);
 if(!route)return false;
 try{
  if(req.method==='POST'&&!route[2]){
   const input=await readJSON(req,360000),text=input?.png;
   if(!input||Array.isArray(input)||Object.keys(input).length!==1||typeof text!=='string'||text.length>349528||text.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(text))throw Object.assign(Error('请上传有效的 PNG 图片数据'),{status:400,code:'cocreation_art_invalid'});
   const bytes=Buffer.from(text,'base64');if(bytes.toString('base64')!==text)throw Object.assign(Error('PNG 编码无效'),{status:400,code:'cocreation_art_invalid'});
   sendJSON(res,200,{art:await assets.put(bytes)});return true;
  }
  if(req.method==='GET'&&route[2]){
   const {bytes}=await assets.read(route[2]);
   res.writeHead(200,{'Content-Type':'image/png','Content-Length':bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}).end(bytes);return true;
  }
  sendJSON(res,405,{error:'不支持此素材操作',code:'cocreation_art_method'});return true;
 }catch(error){sendJSON(res,error.code==='ENOENT'?404:error.status||503,{error:error.code==='ENOENT'?'素材不存在':error.message,code:error.code==='ENOENT'?'cocreation_art_missing':error.code||'cocreation_art_unavailable'});return true;}
}
