import {recoveryReturnURL} from './recoveryNavigation.js';
const key=(theme,namespace)=>namespace+'recovery-return:'+theme;
export function prepareRecoveryReentry(theme,{storage=globalThis.sessionStorage,namespace=globalThis.localStorage?.namespace||'hd-local:',href=globalThis.location?.href,now=Date.now()}={}){
 let url;try{url=recoveryReturnURL(href);}catch{return null;}const nonce=new URL(url).searchParams.get('recoveryReturn');
 try{storage.setItem(key(theme,namespace),JSON.stringify({nonce,at:now}));}catch{}
 return url;
}
export function hasRecoveryReentry(theme,{storage=globalThis.sessionStorage,namespace=globalThis.localStorage?.namespace||'hd-local:',href=globalThis.location?.href,now=Date.now()}={}){
 try{const value=JSON.parse(storage.getItem(key(theme,namespace))||'null'),nonce=new URL(href).searchParams.get('recoveryReturn');return !!nonce&&nonce===value?.nonce&&Number.isFinite(value.at)&&now>=value.at&&now-value.at<30*60*1000;}catch{return false;}
}
export function clearRecoveryReentry(theme,{storage=globalThis.sessionStorage,namespace=globalThis.localStorage?.namespace||'hd-local:'}={}){try{storage.removeItem(key(theme,namespace));}catch{}}
