import {PORTFOLIO_FILE_LIMIT} from './portfolioStore.mjs';
export async function servePortfolio({req,res,pathname,store,owner,authorId,authorName,readJSON,sendJSON}){
 const route=pathname.match(/^\/api\/(?:lan\/)?portfolio(?:\/(action|upload|file\/[a-f0-9-]+))?$/);if(!route)return false;const op=route[1];
 if(!op&&req.method==='GET')sendJSON(res,200,await store.view({owner}));
 else if(op==='action'&&req.method==='POST')sendJSON(res,200,await store.action(await readJSON(req,200000),{owner,authorId,authorName}));
 else if(op==='upload'&&req.method==='POST')sendJSON(res,200,await store.upload(await readJSON(req,Math.ceil(PORTFOLIO_FILE_LIMIT/3)*4+4096),{owner}));
 else if(op?.startsWith('file/')&&req.method==='GET'){const a=await store.asset(op.slice(5),{owner}),download=new URL(req.url,'http://local').searchParams.has('download');res.writeHead(200,{'Content-Type':a.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Content-Disposition':(download||!a.type.startsWith('image/')?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(a.name)}).end(a.bytes);}
 else sendJSON(res,405,{error:'不支持此会客馆操作',code:'portfolio_method'});return true;
}

