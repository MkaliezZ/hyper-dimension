// Harvest modes keep the farm protocol step "harvest" while selecting truthful tools and gestures.
const groups={
 cut:['wheat','rice','flax'],
 root:['carrot','potato','sweet_potato','daikon'],
 pick:['tomato','corn','strawberry','cotton','pea','cucumber','eggplant','blueberry'],
 leaf:['herb','cabbage','kale'],
 lift:['pumpkin']
};
const modes={cut:{toolAction:'harvest',label:'割取谷穗'},root:{toolAction:'hoe',label:'松土拔取'},pick:{toolAction:null,label:'摘取果实'},leaf:{toolAction:null,label:'手采叶菜'},lift:{toolAction:null,label:'托起收获'}};
export const CROP_HARVEST=Object.freeze(Object.fromEntries(Object.entries(groups).flatMap(([mode,ids])=>ids.map(id=>[id,Object.freeze({mode,...modes[mode]})]))));
export function cropHarvestProfile(id){return CROP_HARVEST[id]||null;}
