import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {resolve,dirname} from 'node:path';
const root=resolve('../../outputs/Hyper-Dimension-PRD-v0.1'),manifest=JSON.parse(await readFile(root+'/交付清单-v0.20.json','utf8')),prior=JSON.parse(await readFile(root+'/交付清单-v0.19.json','utf8')),goal=JSON.parse(await readFile('docs/delivery-goal-v25.json','utf8')),report={at:new Date().toISOString(),formalFiles:[],evidence:[],requirements:18,deadline:manifest.deadline,checks:[]};
const hash=s=>createHash('sha256').update(s).digest('hex').toUpperCase();
const headingVersions=s=>{const numbers=[];for(const line of s.split('\n'))if(/^### /.test(line)){const m=line.match(/\bV(\d+)(?:–V(\d+))?/);if(m)for(let v=+m[1];v<=+(m[2]||m[1]);v++)numbers.push(v);}return numbers;};
for(const f of manifest.formalFiles){
 const s=await readFile(root+'/'+f.path,'utf8');assert.equal(hash(s),f.sha256);assert(s.includes('version: v0.20')||s.includes('v0.20-draft'));
 const at=s.indexOf('## 附录');assert(at>0);const body=s.slice(0,at),history=s.slice(at),versions=headingVersions(history),present=new Set(versions);assert(present.has(50));assert(versions.every((n,i)=>!i||n>=versions[i-1]),f.path+' chronological');
 const archived=await readFile(root+'/90-版本复盘摘要/2026-10-05-V49正式正文快照/'+f.path,'utf8');assert.equal(hash(archived),prior.formalFiles.find(x=>x.path===f.path).sha256);
 for(const v of headingVersions(archived.slice(archived.indexOf('## 附录'))))assert(present.has(v),'prior V'+v+' '+f.path);
 if(f.path.startsWith('00-项目索引'))for(let v=33;v<=50;v++)assert(present.has(v),'index V'+v);
 assert(body.includes('## 当前实现与边界（V50）'));assert(!body.includes('## 矿洞与独立钓鱼（V49现行增量）'));assert(!body.includes('## 农田事务与有效时钟（V48阶段证据）'));
 // Preserve old body increment text in the corresponding history section, with only the heading level changed.
 const start=archived.indexOf('## 功能设施与素材一致性（V45）'),oldEnd=archived.indexOf('## 附录');
 for(const chunk of archived.slice(start,oldEnd).split(/(?=^## )/m).filter(x=>x.trim()))assert(history.includes(chunk.trim().replace(/^## /,'#### 同期正文记录：')),'lost former body increment '+f.path);
 report.formalFiles.push({file:f.path,hash:true,priorExactSnapshot:true,bodyBeforeHistory:true,priorBodyInHistory:true,historyAscending:true});
}
assert.equal(goal.requirements.length,18);assert.equal(goal.requirements.filter(r=>r.status==='complete').length,4);assert.equal(goal.requirements.filter(r=>r.status==='in_progress').length,12);assert.equal(goal.requirements.filter(r=>r.status==='pending').length,2);assert.equal(manifest.deadline,'2026-10-10 23:59');
for(const [file,prefix,count]of[['10-规则文件/01-产品需求PRD-v0.1-draft.md','F',28],['20-执行文件/02-验收计划-v0.1-draft.md','T',28]]){
 const body=(await readFile(root+'/'+file,'utf8')).split('## 附录')[0];for(let n=1;n<=count;n++)assert(new RegExp('\\| '+prefix+String(n).padStart(2,'0')+' \\|').test(body),prefix+n+' missing');report.checks.push(prefix+'01-'+prefix+count+' preserved');
}
for(const file of['qa/v50/resident-browser-report.json','qa/v50/compact/resident-browser-report.json','qa/v50/npc-feedback/npc-feedback-report.json','qa/v50/craft-regression/craft-browser-report.json','qa/v50/pottery-regression/pottery-browser-report.json','qa/v50/pottery-regression/deployment.json','qa/v50/deployment.json']){
 const r=JSON.parse(await readFile(file,'utf8'));assert.equal(r.passed,true,file);assert.equal((r.errors||[]).length,0,file);report.evidence.push({file,passed:true});
}
const resident=JSON.parse(await readFile('qa/v50/resident-browser-report.json','utf8'));for(const r of resident.themes){assert(r.actualStewardPauseReturnsTaskHold&&r.actualResumeDeliveryOnce&&r.finishLossRealButtonExactlyOnce&&r.naturalMealConsumesFood);assert.equal(r.npcWorkSeconds,20);}
const pottery=JSON.parse(await readFile('qa/v50/pottery-regression/pottery-browser-report.json','utf8'));for(const theme of['pixel','origami']){const r=pottery.checks.find(x=>x.theme===theme&&x.uniqueProduct);assert(r?.result?.passed);assert(r.pausePreserved);assert.equal(r.glazeBands,4);assert(r.kiln.passed);}
for(const file of['docs/current-baseline-v50.md',root+'/30-业务资料库/2026-10-05-V50居民生产与生活证据.md']){const s=await readFile(file,'utf8');for(const m of s.matchAll(/\]\(([^)]+)\)/g))if(!/^(https?:|#)/.test(m[1]))await stat(resolve(dirname(resolve(file)),m[1]));}
for(const [file,count]of[['qa/v50/regressions.txt',411],['qa/v50/resident-regression.txt',19],['qa/v50/pottery-regression/rules.txt',14]]){const text=await readFile(file,'utf8');assert(new RegExp('tests '+count+'\\b').test(text)&&/fail 0/.test(text));}
assert.equal(JSON.parse(await readFile('qa/v50/docs-manifest.json','utf8')).formalFiles.length,9);
report.checks.push('411 default / 19 resident / 14 pottery rules passed','new evidence links resolve','4 local complete / 12 in progress / 2 pending','7 current browser/deployment evidence reports','V45-V49 former body retained in chronological appendix');
report.passed=true;await writeFile('qa/v50/final-review.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,formalFiles:report.formalFiles.length,evidence:report.evidence.length,checks:report.checks}));
