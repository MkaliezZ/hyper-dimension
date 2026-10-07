import {mkdir,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {WORKSHOP_GAMES} from '../src/workshopCatalog.js';
import {simulateWorkshop} from './v19-play-helpers.mjs';
await mkdir('qa/v41',{recursive:true});
const started=performance.now(),rows=[],failures=[];
for(const [id,game] of Object.entries(WORKSHOP_GAMES)){
 const samples=[];
 for(let d=1;d<=3;d++)for(let n=1;n<=24;n++){
  const seed=n*71+13,{state:s,actions}=simulateWorkshop(+id,seed,d),pass=!!s.result?.passed;
  const sample={seed,difficulty:d,passed:pass,seconds:s.t,actions,quality:s.result?.quality,status:s.status};
  samples.push(sample);if(!pass)failures.push({id:+id,kind:game.kind,...sample,mode:s.mode,phase:s.phase,remaining:s.remaining,gate:s.gate,hull:s.hull,shots:s.shots,lit:s.lit,saved:s.saved,lost:s.lost});
 }
 const row={id:+id,kind:game.kind,title:game.title,samples:samples.length,passed:samples.filter(s=>s.passed).length,difficulties:[1,2,3].map(d=>{const group=samples.filter(s=>s.difficulty===d);return {difficulty:d,passed:group.filter(s=>s.passed).length,secondsMin:Math.min(...group.map(s=>s.seconds)),secondsMax:Math.max(...group.map(s=>s.seconds)),actionsMin:Math.min(...group.map(s=>s.actions)),actionsMax:Math.max(...group.map(s=>s.actions)),qualityMin:Math.min(...group.filter(s=>s.passed).map(s=>s.quality))}})};
 rows.push(row);console.log(JSON.stringify(row));
}
const report={kind:'Known-solution legal input benchmark at 30 simulated frames/s, not human skill, human time or an independent solver proof. Scans generators and control branches for next concrete fixes.',rows,failures,wallSeconds:(performance.now()-started)/1000,passed:failures.length===0};
await writeFile('qa/v41/quality-probe.json',JSON.stringify(report,null,2));console.log(JSON.stringify({failures,wallSeconds:report.wallSeconds}));process.exitCode=failures.length?1:0;
