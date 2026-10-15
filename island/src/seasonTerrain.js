import {terrainTiles,terrainLandmarks} from './mapTileLayout.js';
import {seasonTerrainRepairs} from './seasonTerrainRepairs.js';
export const SEASONS=Object.freeze(['spring','summer','autumn','winter']);
export function seasonalTerrain(theme,season='summer'){
 if(!SEASONS.includes(season))throw Error('invalid_terrain_season');
 return [...terrainTiles(theme),...terrainLandmarks(theme)].map(tile=>{
  const key=tile.id.slice(theme.length+1);
  return {...tile,season,key,originalId:tile.id,id:season==='summer'?tile.id:tile.id+'--'+season,
   url:season==='summer'?tile.url:'/assets/season-terrain-v187/'+theme+'/'+season+'/'+key+'.png'};
 }).concat(seasonTerrainRepairs(theme,season));
}
