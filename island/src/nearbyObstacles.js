// Snapshot moving people for one synchronous route search. Query only buckets
// intersecting the original circle, retaining its exact strict distance test.
export function nearbyObstacleTest(points,radius=15){
 if(!Number.isFinite(radius)||radius<=0)throw TypeError('Invalid obstacle radius');
 const span=radius*2,rows=new Map(),positions=[],overflow=[];
 points.forEach(point=>{
  const x=Number(point.x),y=Number(point.y);if(!Number.isFinite(x)||!Number.isFinite(y))return;
  const position={x,y};positions.push(position);const column=Math.floor(x/span),row=Math.floor(y/span);if(!Number.isSafeInteger(column)||!Number.isSafeInteger(row)){overflow.push(position);return;}
  let columns=rows.get(row);if(!columns)rows.set(row,columns=new Map());let bucket=columns.get(column);if(!bucket)columns.set(column,bucket=[]);bucket.push(position);
 });
 return(x,y)=>{
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const left=Math.floor((x-radius)/span),right=Math.floor((x+radius)/span),top=Math.floor((y-radius)/span),bottom=Math.floor((y+radius)/span);
  const near=point=>Math.hypot(point.x-x,point.y-y)<radius;
  if(![left,right,top,bottom].every(Number.isSafeInteger))return positions.some(near);
  if(overflow.some(near))return true;
  for(let row=top;row<=bottom;row++){const columns=rows.get(row);if(!columns)continue;for(let column=left;column<=right;column++){const bucket=columns.get(column);if(bucket?.some(point=>Math.hypot(point.x-x,point.y-y)<radius))return true;}}
  return false;
 };
}
