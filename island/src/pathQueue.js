// Stable A* priority queue: equal scores retain their original insertion order.
const before=(a,b)=>a.f<b.f||a.f===b.f&&a.sequence<b.sequence;
export class PathQueue {
 constructor(){this.entries=[];this.serial=0;}
 get length(){return this.entries.length;}
 push(value){
  const node={...value,sequence:this.serial++},rows=this.entries;let i=rows.length;rows.push(node);
  while(i>0){const parent=(i-1)>>1;if(!before(node,rows[parent]))break;rows[i]=rows[parent];i=parent;}rows[i]=node;
 }
 shift(){
  const rows=this.entries;if(!rows.length)return undefined;const first=rows[0],last=rows.pop();if(!rows.length)return first;
  let i=0;while(i*2+1<rows.length){let child=i*2+1;if(child+1<rows.length&&before(rows[child+1],rows[child]))child++;if(!before(rows[child],last))break;rows[i]=rows[child];i=child;}rows[i]=last;return first;
 }
}
