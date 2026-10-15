// Native local repaintings reconcile important plot geometry across regional joins.
// These retain the existing building IDs, placement, paths and collision map.
const REPAIRS=[
 ['workshop-porch',656,426,224,192],
 ['terrace-porch',1440,526,208,208],
 ['southwest-yard',516,678,240,212],
 ['hall-court',1940,652,300,240]
];
export function seasonTerrainRepairs(theme,season){
 if(!['spring','summer','autumn','winter'].includes(season))return [];
 return REPAIRS.map(([key,x,y,w,h],index)=>({id:`${theme}-repair-${key}--${season}`,originalId:`${theme}-repair-${key}`,key:'repair-'+key,theme,season,patch:true,patchOrder:10+index,bounds:{x,y,w,h},core:{x:x+16,y:y+16,w:w-32,h:h-32},url:`/assets/season-terrain-v187/${theme}/${season}/repair-${key}.png`}));
}
