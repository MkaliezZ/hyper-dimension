const run=v=>typeof v==='string'&&/^hd-island-[a-f0-9]{32}$/.test(v),proposal=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const id=v=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v),record=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function validStewardPartyMetadata(d){
 if(d.source===undefined)return d.runId==null&&d.proposalId==null;
 return ['player','deepseek','rules'].includes(d.source)?d.runId==null&&d.proposalId==null:d.source==='hermes'&&run(d.runId)&&proposal(d.proposalId);
}
export function validStewardPartyReceipts(f,template){
 const receipts=f.hermesReceipts;if(receipts===undefined)return true;
 if(!record(receipts)||Object.keys(receipts).length>128)return false;
 return Object.entries(receipts).every(([key,r])=>record(r)&&r.ok===true&&r.template===template&&run(r.runId)&&key.startsWith(r.runId+':')&&proposal(key.slice(r.runId.length+1))&&id(r.id)&&Number.isSafeInteger(r.version)&&r.version>0&&r.version<=100000&&typeof r.title==='string'&&r.title.length<=24&&typeof r.reinvite==='boolean'&&(r.projectId===null||id(r.projectId))&&typeof r.preparation==='string'&&r.preparation.length<=200&&typeof r.waiting==='string'&&r.waiting.length<=200);
}
