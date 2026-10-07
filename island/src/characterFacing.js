// Logical headings use screen coordinates: +x right, +y down.
// Audited cells, not a guessed universal sheet-column order.
export function facingCell(theme,id,visitor,heading){
 const result={column:heading,flip:false};
 // A verified front-right pose gives the front-left pose at full body width.
 // Mirroring the whole drawing keeps the head, torso and feet consistent.
 if(heading===1){result.column=7;result.flip=true}
 if(theme==='origami'&&!visitor){
  if(id===12||id===13)return {repair:'v7',row:id-12,column:[0,1,2,3,4,3,2,1][heading],flip:[1,2,3].includes(heading)};
  if([8,10,11].includes(id)&&[2,6].includes(heading))result.column=8-heading;
  if(id===9&&heading===2){result.column=6;result.flip=true}
  if(id===15&&heading===1){result.column=1;result.flip=false}
 }
 return result;
}
