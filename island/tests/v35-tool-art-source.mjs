import fs from 'node:fs';
import {ITEM_BY_ID} from '../src/contentCatalog.js';
import {TOOLS} from '../src/equipmentRules.js';
import {TOOL_ART} from '../src/toolArt.js';
const frames=JSON.parse(fs.readFileSync('public/assets/art-frames-v8.json','utf8')),out=[];
for(const theme of ['pixel','origami'])for(const id of Object.keys(TOOLS)){const item=ITEM_BY_ID[id],file='items-'+theme+'-products-'+Math.floor(item.index/60)+'-v8.png';out.push({id,theme,file,frame:frames[file].frames[item.index%60],...TOOL_ART[theme][id]});}
fs.writeFileSync('qa/v35/tool-art-source.json',JSON.stringify(out,null,2));
