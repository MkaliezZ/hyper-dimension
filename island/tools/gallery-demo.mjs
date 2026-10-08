import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createPortfolioStore} from '../server/portfolioStore.mjs';
const populated=d=>!!(d?.name||d?.headline||d?.bio||d?.experiences?.length||d?.projects?.length);
export async function seedPortfolioDemo({directory,root=resolve(import.meta.dirname,'..'),publish=true}={}){
 if(!directory)throw Error('Specify the exact owner data directory');
 const store=createPortfolioStore({directory:resolve(directory)}),initial=await store.view({owner:true});
 if(initial.published||populated(initial.draft))return{seeded:false,reason:'existing-gallery-preserved'};
 const folder=join(root,'public/assets/portfolio-demo-v131'),draft=JSON.parse(await readFile(join(folder,'profile.json'),'utf8')),images=new Map();
 for(const key of ['studio','community','fieldnotes']){
  const bytes=await readFile(join(folder,key+'.png')),sha=createHash('sha256').update(bytes).digest('hex'),current=await store.view({owner:true});
  if(current.published||populated(current.draft))return{seeded:false,reason:'concurrent-gallery-preserved'};
  const old=current.assets.find(a=>a.sha256===sha&&a.name==='虚构示例-'+key+'.png');
  const id=old?.id||(await store.upload({name:'虚构示例-'+key+'.png',type:'image/png',base64:bytes.toString('base64')},{owner:true})).uploadedId;images.set(key,id);
 }
 draft.experiences=draft.experiences.map(e=>({...e,id:randomUUID()}));
 draft.projects=draft.projects.map(({demoImage,...project})=>({...project,id:randomUUID(),files:[images.get(demoImage)]}));
 let current=await store.view({owner:true});if(current.published||populated(current.draft))return{seeded:false,reason:'concurrent-gallery-preserved'};
 current=await store.action({operation:'save',requestId:randomUUID(),revision:current.revision,draft},{owner:true});
 if(publish)current=await store.action({operation:'publish',requestId:randomUUID(),revision:current.revision},{owner:true});
 return{seeded:true,published:!!current.published,experiences:current.draft.experiences.length,projects:current.draft.projects.length,images:images.size,fictional:true};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const args=process.argv.slice(2);if(args.length!==1||!args[0].startsWith('--directory='))throw Error('Use node tools/gallery-demo.mjs --directory=<exact owner directory>; existing content is never replaced');
 console.log(JSON.stringify(await seedPortfolioDemo({directory:args[0].slice(12)})));
}
