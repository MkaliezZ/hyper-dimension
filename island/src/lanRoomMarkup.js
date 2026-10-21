// Keep the live map and its ancestor chain attached while room chrome updates.
// A different layout is mounted normally;no stale markup is silently retained.
export function retainRoomMapStage(root,markup,stage){
 if(!stage||stage.id!=='lanMapStage'||!root.contains(stage))return false;
 const template=document.createElement('template');template.innerHTML=markup;
 const nextStage=template.content.querySelector('#lanMapStage');if(!nextStage)return false;
 const path=(node,stop)=>{const list=[];for(;node&&node!==stop;node=node.parentNode)list.unshift(node);return node===stop?list:null;};
 const oldPath=path(stage,root),newPath=path(nextStage,template.content);
 if(!oldPath||!newPath||oldPath.length!==newPath.length||oldPath.some((n,i)=>n.tagName!==newPath[i].tagName||n.id!==newPath[i].id))return false;
 for(let i=0;i<oldPath.length;i++){
  const keep=oldPath[i],nextKeep=newPath[i],parent=i?oldPath[i-1]:root,nextParent=i?newPath[i-1]:template.content;
  for(const a of [...keep.attributes])if(!nextKeep.hasAttribute(a.name))keep.removeAttribute(a.name);
  for(const a of nextKeep.attributes)if(keep.getAttribute(a.name)!==a.value)keep.setAttribute(a.name,a.value);
  for(const child of [...parent.childNodes])if(child!==keep)child.remove();
  let after=false;for(const child of [...nextParent.childNodes]){
   if(child===nextKeep){after=true;continue;}
   if(after)parent.append(child);else parent.insertBefore(child,keep);
  }
 }
 return true;
}
