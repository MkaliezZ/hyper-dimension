// Register both themes, fetch only the selected theme until the player switches.
const rows=[],activated=new Set();
export function initialArtworkTheme(){
 const value=new URLSearchParams(location.search).get('theme')||document.body.dataset.theme;
 return value==='origami'?'origami':'pixel';
}
activated.add(initialArtworkTheme());
function load(row,retry=false){
 if(row.promise&&!retry)return row.promise;
 row.image.src=row.url;row.error=null;
 row.promise=row.image.decode().catch(error=>{row.error=error;throw error;});
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
export function themeArtworkStatus(){return {activated:[...activated],registered:rows.length,requested:rows.filter(row=>row.promise).length,failed:rows.filter(row=>row.error).length};}
