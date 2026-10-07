
import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import {resolve,sep} from 'node:path';
const root=resolve('../../outputs/Hyper-Dimension-PRD-v0.1'),manifest=JSON.parse(await readFile(root+'/交付清单-v0.22.json','utf8')),prior=JSON.parse(await readFile(root+'/交付清单-v0.21.json','utf8')),goal=JSON.parse(await readFile('docs/delivery-goal-v25.json','utf8')),report={at:new Date().toISOString(),formalFiles:[],evidence:[],requirements:18,deadline:manifest.deadline,checks:[]};
const hash=s=>createHash('sha256').update(s).digest('hex').toUpperCase();
const headingVersions=s=>{const numbers=[];for(const line of s.split('\n'))if(/^### /.test(line)){const m=line.match(/\bV(\d+)(?:–V(\d+))?/);if(m)for(let v=+m[1];v<=+(m[2]||m[1]);v++)numbers.push(v);}return numbers;};
for(const f of manifest.formalFiles){
 const s=await readFile(root+'/'+f.path,'utf8');assert.equal(hash(s),f.sha256);assert(s.includes('version: v0.22')||s.includes('v0.22-draft'));
 const at=s.indexOf('## 附录');assert(at>0);const body=s.slice(0,at),history=s.slice(at),versions=headingVersions(history),present=new Set(versions);assert(present.has(52));assert(versions.every((n,i)=>!i||n>=versions[i-1]));
 const archived=await readFile(root+'/90-版本复盘摘要/2026-10-05-V51正式正文快照/'+f.path,'utf8');assert.equal(hash(archived),prior.formalFiles.find(x=>x.path===f.path).sha256);
 for(const v of headingVersions(archived.slice(archived.indexOf('## 附录'))))assert(present.has(v),'prior V'+v+' '+f.path);if(f.path.startsWith('00-项目索引'))for(let v=33;v<=52;v++)assert(present.has(v));
 assert(body.includes('## 当前实现与边界（V52）'));assert(!body.includes('## 当前实现与边界（V51）'));const start=archived.indexOf('## 当前实现与边界（V51）'),oldEnd=archived.indexOf('## 附录');assert(history.includes(archived.slice(start,oldEnd).trim().replace(/^## /,'#### 同期正文记录：')));
 report.formalFiles.push({file:f.path,hash:true,priorExactSnapshot:true,bodyBeforeHistory:true,priorBodyInHistory:true,historyAscending:true});
}
assert.equal(goal.requirements.length,18);assert.equal(goal.requirements.filter(r=>r.status==='complete').length,4);assert.equal(goal.requirements.filter(r=>r.status==='in_progress').length,12);assert.equal(goal.requirements.filter(r=>r.status==='pending').length,2);assert.equal(manifest.deadline,'2026-10-10 23:59');
for(const[file,prefix,count]of [['10-规则文件/01-产品需求PRD-v0.1-draft.md','F',28],['20-执行文件/02-验收计划-v0.1-draft.md','T',28]]){const body=(await readFile(root+'/'+file,'utf8')).split('## 附录')[0];for(let n=1;n<=count;n++)assert(new RegExp('\\| '+prefix+String(n).padStart(2,'0')+' \\|').test(body));report.checks.push(prefix+'01-'+prefix+count+' preserved');}
for(const [file,n]of [['qa/v52/regressions.txt',445],['qa/v52/commerce-regression.txt',18]]){const s=await readFile(file,'utf8');assert(new RegExp('tests '+n+'\\b').test(s)&&/fail 0/.test(s));report.checks.push(n+' rules passed');}
for(const file of ['qa/v52/commerce-browser-report.json','qa/v52/career-regression/browser-report.json','qa/v52/pottery-regression/pottery-browser-report.json','qa/v52/deployment.json']){
 const r=JSON.parse(await readFile(file,'utf8'));assert.equal(r.passed,true,file);assert.equal((r.errors||[]).length,0,file);assert.equal((r.apiErrors||[]).length,0,file);assert.equal((r.badAssets||r.badImages||[]).length,0,file);report.evidence.push({file,passed:true});
}
const commerce=JSON.parse(await readFile('qa/v52/commerce-browser-report.json','utf8'));assert.equal(commerce.themes.length,2);
for(const r of commerce.themes)assert(r.actualDayTailAndOneSettlement&&r.realOrderButton&&r.orderLossRealRetryOnce&&r.supplyLossReloadOnce&&r.actualUpgradeAndMaintenance&&r.compactNoOverflow&&r.daySeconds===900);
const career=JSON.parse(await readFile('qa/v52/career-regression/browser-report.json','utf8'));assert(resolve(career.directory).startsWith(resolve('qa/v52')+sep));assert.equal(career.checks.length,2);
for(const r of career.checks){
 assert(r.nativeJoinery&&r.postAcceptCharacterCraft&&r.onePayment&&r.ceremonyCancelAndClaim&&r.permanentTitle&&r.diskReloadNoDuplicate&&r.compactNoOverflow&&r.scrolledCloseVisible);
 const doc=JSON.parse(await readFile(resolve(career.directory,r.theme,'current.json'),'utf8')),s=doc.state,c=s.specialization.commission,production=s.resourceLedger.receipts[c.production.command];
 assert.equal(c.status,'delivered');assert.equal(s.specialization.deliveries.artisan,1);assert.match(c.production.command,/^player:craft:[1-9]\d*:result$/);assert.equal(production.category,'craft');assert.equal(production.actor,-1);assert.equal(production.playerQuality,r.quality);assert.equal(production.delta[c.item],1);assert(Number(c.production.command.split(':')[2])>c.acceptedSequence);
 const paid=s.resourceLedger.receipts['cash:'+c.id];assert.equal(paid.delta[c.item],-1);assert.equal(paid.delta.coins,c.net);assert.equal(paid.production.command,c.production.command);
}
const pottery=JSON.parse(await readFile('qa/v52/pottery-regression/pottery-browser-report.json','utf8'));assert(resolve(pottery.directory).startsWith(resolve('qa/v52')+sep));
for(const theme of ['pixel','origami']){
 const partial=pottery.checks.find(r=>r.theme===theme&&r.flow==='standard shape rejection and partial exit');assert(partial?.reservationReleased&&partial.noPersonalProduct);
 const result=pottery.checks.find(r=>r.theme===theme&&r.uniqueProduct);assert(result?.pausePreserved&&result.kiln.passed&&result.result.passed&&result.glazeBands===4);const doc=JSON.parse(await readFile(resolve(pottery.directory,theme,'current.json'),'utf8')),paid=doc.actions.receipts.filter(r=>r.ticket.kind==='craft'&&r.outcome==='finished');assert.equal(paid.length,1);
 const receipt=doc.state.resourceLedger.receipts[paid[0].resourceReceiptId];assert(receipt);const [owner,cost,gain]=JSON.parse(receipt.signature);assert.equal(owner,paid[0].ticket.owner);assert.equal(gain[result.recipe],1);assert.equal(receipt.delta[result.recipe],1);assert.equal(doc.state.economy.playerGoods[result.recipe],1);assert.equal(doc.state.craftHistory[paid[0].ticket.recipeId],1);
 assert.deepEqual(cost,paid[0].cost);assert(!doc.state.resourceLedger.reservations[owner]);
}
const deployment=JSON.parse(await readFile('qa/v52/deployment.json','utf8'));assert.equal(deployment.services.length,2);for(const r of deployment.services){assert.equal(r.saveProtocol.commerce,1);assert.equal(r.saveProtocol.dayActiveClock,true);assert.equal(r.files.length,17);assert(r.saveUnchangedAtRestart);assert.equal(r.model,'deepseek-flash');}
report.checks.push('Actual dual-theme commerce/career/pottery stored receipts and reload evidence audited','Production protocol/source/save hashes verified','All R01-R18 statuses and deadline preserved');
report.passed=true;await writeFile('qa/v52/final-review.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,formalFiles:report.formalFiles.length,evidence:report.evidence.length,checks:report.checks,status:'4/12/2',deadline:report.deadline}));
