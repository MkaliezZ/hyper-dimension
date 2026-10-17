import assert from 'node:assert/strict';
import {residentSchedule} from '../src/residentSchedule.js';

// Keep useful work and ordinary calendar waiting separate. This only observes
// the real world clock: it cannot advance time, move actors or complete work.
export async function waitForScheduledProject(page,id,{workingBudgetMs=360000,calendarBudgetMs=1800000,onSample=async()=>{}}={}){
 const started=Date.now(),result={workingBudgetMs,calendarBudgetMs,workingMs:0,samples:[]};let previous=started,lastSample=0;
 for(;;){
  const stamp=Date.now(),s=await page.evaluate(id=>{const s=window.islandInspect();return{environment:s.environment,ready:s.workProjects.some(p=>p.id===id&&p.status==='ready'),pending:s.agentTaskLedger.filter(t=>t.projectId===id&&t.remaining>0)};},id);
  if(s.pending.some(t=>residentSchedule(t.npcId,s.environment)?.working))result.workingMs+=stamp-previous;previous=stamp;
  assert(result.workingMs<=workingBudgetMs,'Original eligible working-time budget exceeded');assert(stamp-started<=calendarBudgetMs,'Normal calendar waiting budget exceeded');
  if(stamp-lastSample>=5000){lastSample=stamp;result.samples.push({clock:s.environment.clockText,workingMs:result.workingMs,pending:s.pending.map(t=>({id:t.id,status:t.status,completed:t.completed,period:residentSchedule(t.npcId,s.environment)?.period}))});await onSample(result);}
  if(s.ready){result.calendarMs=Date.now()-started;return result;}
  await page.waitForTimeout(500);
 }
}
