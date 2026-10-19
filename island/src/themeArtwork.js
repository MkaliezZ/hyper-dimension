// Register both themes, fetch only the selected theme until the player switches.
const rows=[],activated=new Set();
export function initialArtworkTheme(){
 const value=new URLSearchParams(location.search).get('theme')||document.body.dataset.theme;
 return value==='origami'?'origami':'pixel';
}
activated.add(initialArtworkTheme());
async function decodeArtwork(row){
 const delays=[150,350];
 for(let attempt=0;;attempt++){
  row.decodeAttempts=attempt+1;
  try{await row.image.decode();return;}
  catch(error){
   if(attempt>=delays.length)throw error;
   // A completed valid image can still lose a Chromium decode task under load.
   // Retry its decode without discarding the image or accepting a placeholder.
   await new Promise(resolve=>setTimeout(resolve,delays[attempt]));
   if(!row.image.complete||!row.image.naturalWidth)row.image.src=row.url;
  }
 }
}
function load(row,retry=false){
 if(row.promise&&(!retry||row.loading))return row.promise;
 row.image.src=row.url;row.error=null;row.loading=true;
 row.promise=decodeArtwork(row).catch(error=>{row.error=error;throw error;}).finally(()=>{row.loading=false;});
 row.promise.catch(()=>{});
 return row.promise;
}
export function registerThemeArtwork(image,url,theme){
 const row={image,url,theme,promise:null,error:null};rows.push(row);
 if(activated.has(theme))load(row);
 return image;
}
export async function activateThemeArtwork(theme){
 if(!['pixel','origami'].includes(theme))throw Error('invalid_artwork_theme');
 activated.add(theme);
 await Promise.all(rows.filter(row=>row.theme===theme).map(row=>load(row,!!row.error)));
}
export function themeArtworkStatus(){return {activated:[...activated],registered:rows.length,requested:rows.filter(row=>row.promise).length,failed:rows.filter(row=>row.error).length,retrying:rows.filter(row=>row.loading&&row.decodeAttempts>1).length,recovered:rows.filter(row=>row.promise&&!row.error&&!row.loading&&row.decodeAttempts>1).map(row=>({url:row.url,theme:row.theme,attempts:row.decodeAttempts})),failures:rows.filter(row=>row.error).map(row=>({url:row.url,theme:row.theme,attempts:row.decodeAttempts,errorName:row.error?.name||'Error',errorMessage:String(row.error?.message||row.error).slice(0,160)}))};}
