import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {validateSaveDocument} from '../server/saveStore.mjs';
import {syncPersonalState,assertPersonalState} from '../server/personalActions.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {ITEM_BY_ID} from '../src/contentCatalog.js';
import {SEASONAL_RECIPES} from '../src/seasonalRecipes.js';
import {PRODUCTION_VERSION} from '../src/productionNetwork.js';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const added=['cabbage','pea','cucumber','eggplant','blueberry','sweet_potato','daikon','kale',...SEASONAL_RECIPES.map(r=>r.item)];

for(const theme of ['pixel','origami'])test(`${theme} actual LAN entry upgrades old catalog before hydration, preserves active party and supports save/action/reload`,async()=>{
 const directory=await mkdtemp(join(await realpath(tmpdir()),'hd-v177-catalog-'));let now=1800000000000;
 const service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-CATALOG',now:()=>now});
 try{
  const user=await service.identities.register({login:'catalog_owner',password:'isolated-password',name:'迁移验证',islandName:'存档验证岛',avatar:'female_1',theme});
  const c=await service.tenants.get(user.token),state=hydrateTown(createZeroState());
  state.freshStartPending=false;state.day=120;state.coins=200;Object.assign(state.inventory,{wood:17,wheat:6,lantern:2,tea:1,unknown_future_material:9});state.partyInvites={0:true,2:true};
  await c.saves.open(theme,{legacyState:state,protect:true});
  const base='http://127.0.0.1:'+service.port,headers={Cookie:'hd_lan_session='+user.token,'Content-Type':'application/json','X-HD-Island':user.view.me.id};
  async function post(op,input){const r=await fetch(base+'/api/saves/'+theme+'/'+op,{method:'POST',headers,body:JSON.stringify(input)}),body=await r.json();assert.equal(r.status,200,JSON.stringify({op,code:body.code,error:body.error}));return body;}
  let doc=(await post('open',{})).document;
  async function action(input){const body={...input,requestId:input.requestId||randomUUID(),expectedVersion:doc.version,expectedSequence:doc.actions.sequence,epoch:doc.actions.epoch};const result=await post('action',body);doc=result.document;return {...result,input:body};}
  await action({kind:'personal',operation:'use',itemId:'tea',day:doc.state.day});
  const party=await action({kind:'party',operation:'begin',fireworks:false});assert.equal(party.ticket.kind,'party');
  const legacy=structuredClone(doc);legacy.state.productionVersion=123;
  for(const id of added){assert.equal(legacy.state.inventory[id],0);delete legacy.state.inventory[id];}
  syncPersonalState(legacy.state,legacy.actions);legacy.checksum=hash(legacy.state);legacy.actionsChecksum=hash(legacy.actions);validateSaveDocument(legacy,theme);
  const file=join(c.directory,theme,'current.json');await writeFile(file,JSON.stringify(legacy));
  assert.throws(()=>assertPersonalState(hydrateTown(structuredClone(legacy.state)),legacy.actions),e=>e.code==='personal_state_conflict','fixture reproduces the pre-fix browser conflict');
  const hostile=structuredClone(legacy.state);hostile.coins=999999;hostile.inventory.cabbage=99999;
  const migrated=(await post('open',{legacyState:hostile})).document;doc=migrated;
  assert.equal(doc.reason,'catalog-migration-v176');assert.equal(doc.state.productionVersion,PRODUCTION_VERSION);assert.equal(doc.revision,legacy.revision+1);
  assert.equal(doc.state.coins,legacy.state.coins);assert.equal(doc.state.day,120);assert.equal(doc.state.saveSlot,legacy.state.saveSlot);
  for(const [id,n]of Object.entries(legacy.state.inventory))assert.equal(doc.state.inventory[id],n,id);
  for(const id of added)assert.equal(doc.state.inventory[id],0,id);
  assert.equal(Object.keys(doc.state.inventory).length,Object.keys(legacy.state.inventory).length+16);
  for(const key of ['resourceLedger','partySession','partyInvites','npcProfiles','butlerAvatar','discovered'])assert.deepEqual(doc.state[key],legacy.state[key],key);
  for(const key of ['active','receipts','resident','visitor','party'])assert.deepEqual(doc.actions[key],legacy.actions[key],key);
  assertPersonalState(hydrateTown(structuredClone(doc.state)),doc.actions);
  const backups=await c.saves.backups(theme);assert.equal(backups.filter(b=>b.reason==='before-catalog-v176').length,1);
  assert.equal((await post('open',{})).document.version,doc.version,'open is idempotent');
  const hydrated=hydrateTown(structuredClone(doc.state));now+=1000;
  doc=(await post('save',{state:hydrated,expectedVersion:doc.version,saveId:randomUUID(),activeSeconds:0})).document;
  assert.deepEqual(doc.actions.active,legacy.actions.active);
  const avatar=await action({kind:'personal',operation:'avatar',target:'butler',avatarId:'male_4',day:doc.state.day});
  assert.equal(doc.state.butlerAvatar,'male_4');assert.deepEqual(doc.actions.active,legacy.actions.active);
  assert.equal(doc.state.coins,legacy.state.coins);assert.deepEqual(doc.state.inventory,migrated.state.inventory);
  const beforeReload=doc.version;doc=(await post('open',{})).document;assert.equal(doc.version,beforeReload);assert.equal(doc.state.butlerAvatar,'male_4');
  const replay=await post('action',avatar.input);assert(replay.replayed);assert.equal(replay.document.version,doc.version);
  assert.equal(doc.actions.receipts.filter(r=>r.ticket.requestId===avatar.ticket.requestId).length,1);
  const tampered=structuredClone(doc.state);tampered.inventory.cabbage=1;
  const rejected=await fetch(base+'/api/saves/'+theme+'/save',{method:'POST',headers,body:JSON.stringify({state:tampered,expectedVersion:doc.version,saveId:randomUUID(),activeSeconds:0})});
  assert.equal(rejected.status,409);assert.equal((await rejected.json()).code,'personal_state_conflict');
  const final=JSON.parse(await readFile(file,'utf8'));assert.equal(final.version,doc.version);assert.deepEqual(final.actions.active,legacy.actions.active);
  assert(Object.keys(ITEM_BY_ID).every(id=>Object.hasOwn(final.state.inventory,id)));validateSaveDocument(final,theme);
 }finally{await service.close();}
});
