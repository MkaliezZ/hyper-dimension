import {residentSchedule} from './residentSchedule.js';

const clock=value=>String(Math.floor(value)).padStart(2,'0')+':'+String(Math.round(value%1*60)).padStart(2,'0');
export function taskWorkWindow(id,environment,needs={}){
 const schedule=residentSchedule(id,environment);if(!schedule)return '';
 const hours=clock(schedule.start)+'–'+clock(schedule.end);
 if(schedule.sleeping)return '正在休息；工作时段 '+hours+'，上班后继续排队工作。';
 if(!schedule.working)return '当前已下班；工作时段 '+hours+'，上班后继续排队工作。';
 if((needs.hunger??100)<30)return '先用餐恢复状态，再继续已排队的工作。';
 if((needs.energy??100)<20)return '先休息恢复精力，再继续已排队的工作。';
 return '';
}
