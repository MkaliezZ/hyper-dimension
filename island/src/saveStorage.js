// A new run gets its own slot: an older open tab cannot overwrite it.
export const legacySaveKey=theme=>'hyper-dimension-'+theme+'-v3';
export const activeSlotKey=theme=>'hyper-dimension-'+theme+'-active-slot';
export function validSaveSlot(theme,key){
 const base=legacySaveKey(theme);
 return key===base||typeof key==='string'&&key.startsWith(base+'-restart-')&&/^[a-z0-9-]+$/.test(key.slice((base+'-restart-').length));
}
export function activeSaveKey(theme,storage=localStorage){
 const key=storage.getItem(activeSlotKey(theme));
 return validSaveSlot(theme,key)?key:legacySaveKey(theme);
}
export function readSave(theme,storage=localStorage){
 const key=activeSaveKey(theme,storage),raw=storage.getItem(key);
 if(!raw)return null;
 const state=JSON.parse(raw);
 if(state&&state.inventory&&state.player)return {...state,saveSlot:key};
 return null;
}
export function writeSave(theme,state,storage=localStorage,serialized){
 const key=validSaveSlot(theme,state.saveSlot)?state.saveSlot:legacySaveKey(theme);
 storage.setItem(key,serialized??JSON.stringify(state));
}
