// Keep the same bounded action book while ordinary island life continues.
// A completed assigned step must not lose its replay evidence during an
// overnight dependency wait. Reserve up to half the existing 128 entries for
// recent assigned completions; fill the rest with the newest other receipts.
const LIMIT=128,ASSIGNED_LIMIT=64;
const assigned=r=>r?.outcome==='finished'&&['resident','field','farm','craft'].includes(r.ticket?.kind)&&typeof r.ticket.assignmentId==='string'&&r.ticket.assignmentId.length>0&&typeof r.ticket.operationId==='string'&&r.ticket.operationId.length>0;
export function appendActionReceipt(book,receipt){
 const rows=[...book.receipts,receipt];
 if(rows.length<=LIMIT){book.receipts=rows;return;}
 const pinned=new Set();
 for(let i=rows.length-1;i>=0&&pinned.size<ASSIGNED_LIMIT;i--)if(assigned(rows[i]))pinned.add(i);
 const keep=new Set(pinned);
 for(let i=rows.length-1;i>=0&&keep.size<LIMIT;i--)keep.add(i);
 book.receipts=rows.filter((_,i)=>keep.has(i));
}
