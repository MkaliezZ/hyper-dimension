import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
const formal=resolve('../../outputs/Hyper-Dimension-PRD-v0.1'),paths=['00-项目索引-v0.1-draft.md','00-根文件/01-项目总纲-v0.1-draft.md','10-规则文件/01-产品需求PRD-v0.1-draft.md','10-规则文件/02-内容与经济设计-v0.1-draft.md','10-规则文件/03-技术架构-v0.1-draft.md','10-规则文件/04-美术与动画规范-v0.1-draft.md','10-规则文件/05-现行基线-v0.2-draft.md','20-执行文件/01-开发排期-v0.1-draft.md','20-执行文件/02-验收计划-v0.1-draft.md'],rows=[];
const clean=v=>v.replaceAll('\r',''),versions=s=>s.split('\n').filter(l=>l.startsWith('### ')).map(l=>l.match(/V(\d+)(?!\d)/)?.[1]).filter(Boolean).map(Number);
for(const path of paths){
 const content=clean(await readFile(resolve(formal,path),'utf8')),old=clean(await readFile(resolve(formal,'90-版本复盘摘要/历史方案-v43-before-v44',path),'utf8')),i=content.indexOf('## 附录：版本实装记录'),j=old.indexOf('## 附录：版本实装记录');
 assert(i>0);assert.match(content.slice(0,i),/^## (?:1\.|当前口径)/m);assert(!/^##+ V(?:33|34|35|36|37|38|39|40|41|42|43|44)(?!\d)/m.test(content.slice(0,i)));
 const order=versions(content);assert.deepEqual(order,[33,35,36,37,38,39,40,41,42,43,44]);assert.match(content,/version: v0\.14/);
 const history=old.slice(j).replace('（V33–V43）','（V33–V44）').trimEnd();assert(content.slice(i).startsWith(history));
 rows.push({path,bodyFirst:true,versionNotesAtEnd:true,versionOrder:order,v43HistoryPreserved:true});
}
const readme=clean(await readFile('README.md','utf8')),oldReadme=clean(await readFile('qa/v44/baseline/README.md','utf8')),start=readme.indexOf('## 附录：版本更新记录'),oldStart=oldReadme.indexOf('## 附录：版本更新记录');
assert(start>readme.indexOf('## 完整剩余范围'));assert(readme.slice(start).startsWith(oldReadme.slice(oldStart).trimEnd()));assert(readme.trimEnd().endsWith('保持。'));
const readmeOrder=[...readme.slice(start).matchAll(/^### [Vv](\d+(?:\.\d+)?)/gm)].map(m=>Number(m[1]));assert(readmeOrder.every((v,i)=>i===0||v>=readmeOrder[i-1]));assert.equal(readmeOrder.at(-1),44);
rows.push({path:'README.md',bodyFirst:true,versionNotesAtEnd:true,versionOrder:readmeOrder,v43HistoryPreserved:true});
const report={at:new Date().toISOString(),formalDocuments:9,readme:true,rows,bodyFirst:true,versionNotesAtEnd:true,historyPreserved:true,passed:true};await writeFile('qa/v44/docs-layout-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,formalDocuments:9,readme:true,bodyFirst:true,historyPreserved:true,versionsAtEnd:true}));
