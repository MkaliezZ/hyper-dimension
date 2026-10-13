import {SEASON_NAMES} from './environmentClock.js';
import {SEASONAL_CROPS} from './seasonalRecipes.js';
const ALL=Object.freeze(['spring','summer','autumn','winter']);
export const CROP_SEASONS=Object.freeze({wheat:ALL,herb:ALL,
 carrot:['spring','autumn','winter'],potato:['spring','autumn','winter'],
 tomato:['summer','autumn'],pumpkin:['summer','autumn'],corn:['summer','autumn'],
 rice:['spring','summer'],strawberry:['spring'],cotton:['summer','autumn'],flax:['spring','autumn'],
 ...Object.fromEntries(Object.entries(SEASONAL_CROPS).map(([id,c])=>[id,c.seasons]))});
export const cropSeasons=id=>CROP_SEASONS[id]||[];
export const canPlantCrop=(id,season)=>cropSeasons(id).includes(season);
export const cropSeasonLabel=id=>cropSeasons(id).length===4?'四季可种':cropSeasons(id).map(k=>SEASON_NAMES[k]).join(' / ')+'季';
