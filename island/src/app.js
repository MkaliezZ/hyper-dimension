import {configureWorldSession,worldStorageTheme} from './worldSession.js';
import {worldFetch as fetch} from './worldSession.js';
import {createResidentChatUI} from './residentChatUI.js';
import {createShopfrontUI} from './shopfrontUI.js';
import {residentLifeSummary} from './residentLife.js';
import {createPartyHostingRuntime} from './partyHostingRuntime.js';
import {hostingDraft,hostingMatches} from './partyHosting.js';
import {createFireworksUI} from './fireworksUI.js';
import {createFireworksRuntime} from './fireworksRuntime.js';
import {mountFireworks} from './fireworksView.js';
import {fireworksPlatforms,drawFireworksPlatform} from './fireworksArt.js';
import {createCoutureUI} from './coutureUI.js';
import {createCoutureRuntime} from './coutureRuntime.js';
import {mountCouture} from './coutureView.js';
import {coutureStage,drawCoutureStage} from './coutureArt.js';
import {createFestivalUI} from './festivalUI.js';
import {createFestivalRuntime} from './festivalRuntime.js';
import {mountMarket} from './marketView.js';
import {marketStalls,drawMarketStall} from './marketArt.js';
import{nightReadiness}from'./nightPartyPlanning.js';
import{partyDraftStamp}from'./partyPlanning.js';
import {openResidentTravelHistory} from './lanSocialUI.js';
import {setRecoveryDialog,configureActionRecovery,isRecoveryTarget} from './actionRecoveryUI.js';
import {createServerPersonal} from './serverPersonalUI.js';
import {createServerFacility} from './serverFacilityUI.js';
import {createNightPartyRuntime,nightPartyArrived} from './nightPartyRuntime.js';
import {mountNightParty} from './nightPartyView.js';
import {createServerCommerce} from './serverCommerceUI.js';
import {createServerVisitor} from './serverVisitorUI.js';
import {createServerResident} from './serverResidentUI.js';
import {createServerFieldNpc} from './serverFieldNpcUI.js';
import {mountMiningGame} from './miningGameUI.js';
import {mountWorkshopGame} from './workshopGames.js';
import {acceptedRecipe} from './recipeContracts.js';
import {createServerCraft} from './serverCraftUI.js';
import {createServerFarm} from './serverFarmUI.js';
import {createServerGather} from './serverGatherUI.js';
import {hydrateFunctionalFacilities,tickFunctionalFacilities} from './functionalFacilities.js';
import {createFunctionalUI} from './functionalUI.js';
import {drawFarmIrrigation,functionalArtStatus} from './functionalArt.js';
import {createWorkbenchUI} from './workbenchUI.js';
import {createRunManagementUI} from './runManagementUI.js';
import {hydrateNpcProfileAudit,npcAuditProfile,editNpcProfile} from './npcProfileAudit.js';
import {createNpcProfileAuditUI} from './npcProfileAuditUI.js';
import {createSpecializationUI} from './specializationUI.js';
import {hydrateSpecialization,specializationMoment,claimSpecialization,SPECIALIZATIONS} from './specialization.js';
import {drawSpecializationLandmark} from './specializationArt.js';
import {createResidentStoriesUI} from './residentStoriesUI.js';
import {relationshipInvitation} from './residentStories.js';
import{createNightPartyUI}from'./nightPartyUI.js';
import {createFishingPartyUI} from './fishingPartyUI.js';
import {createCollectionsUI} from './collectionsUI.js';
import {createPlacementUI} from './placementUI.js';
import {hydratePlacements,decorationColliders} from './placements.js';
import {drawDecoration,hitDecoration} from './placementArt.js';
import {syncWonders,setWonderDisplay} from './eventWonders.js';
import {refreshAchievements} from './achievements.js';
import {createFishingPartyRuntime,fishingSpots} from './fishingPartyRuntime.js';
import {fishingCheckin,eventRequests} from './fishingParty.js';
import {drawFishingWonder,wonderPlacements} from './fishingWonderArt.js';
import {createProjectUI} from './projectUI.js';
import {createRecruitmentUI} from './recruitmentUI.js';
import {createRecruitmentRuntime} from './recruitmentRuntime.js';
import {RECRUIT_CANDIDATE} from './recruitmentCatalog.js';
import {playerProjectTask} from './projectPlans.js';
import {beginTaskStep,recordTaskStep} from './taskBoard.js';
import {availableQuantity,canSpendResources,commitResources,reserveResources,releaseResources,nextOperationId} from './resourceLedger.js';
import {createSaveClient} from './saveClient.js';
import {createSaveUI} from './saveUI.js';
import {activeSlotKey} from './saveStorage.js';
import {drawRaster,canvasResolution,rasterTransform,rasterQualityStatus} from './rasterQuality.js';
import {terrainTileStatus} from './mapTiles.js';
import {terrainOverviewURL} from './mapTileLayout.js';
import {seaTileStatus} from './seaTiles.js';
import {HOUSE_ATLAS_BOUNDS} from './houseAtlasBounds.js';
import {registerThemeArtwork,activateThemeArtwork,themeArtworkStatus} from './themeArtwork.js';
import {hydrateJourney,trackJourney,refreshJourney,journeyView,claimMoment,MOMENTS} from './journey.js';
import {createCoCreationUI} from './cocreationUI.js';
import {createJourneyUI,momentSeal} from './journeyUI.js';
import {createStewardChat} from './stewardChat.js';
import {createPartyGuideUI} from './partyGuideUI.js';
import {advanceModalNavigation} from './modalNavigation.js';
import {drawJourneyLandmarks,drawMomentPerformance} from './journeyArt.js';
import {WORKSHOP_GAMES} from './workshopCatalog.js';
import {applyHUDArt} from './uiArt.js';
import {getSoundMixer} from './soundMixer.js';
import {createWorldSound} from './worldSound.js';
import {getSoundUI} from './soundUI.js';
import {effectiveQuality,qualityCap,improveQuality,upgradeCost,maintenanceCost,canPay,upgradeFacility,maintainFacility,buySupplies,SUPPLY_PACKS,dayAccounts,partyCost,canHostParty,reserveParty,completeParty,tickTownEconomy,townDailyBudget,projectedDayAccounts,townOrders,recordPlayerGoods,deliverTownOrder,ECONOMY_RULES} from './economy.js';
import {itemPurpose} from './itemPurpose.js';
import {createContentUI} from './contentUI.js';
import {residentPortraitMarkup} from './residentPortraits.js';
import {itemMarkup,drawItem,artReady,artStatus} from './artStore.js';
import {avatarPortrait,avatarThumbnail} from './avatars.js';
import {ALL_RECIPES,RAW_MATERIALS,RECIPE_BY_ID,DEFAULT_RECIPES,recipeGate,canCraft,commitRecipe,resourceLoot,takeCraftNutrition} from './contentCatalog.js';
import {mountActivityGame} from './activityGames.js';
import {followPath,followPendingPath} from './movement.js';
import {shouldYield} from './harborNavigation.js';
import {CROPS,FARM_LAYOUTS,insidePlot,plotPoint,cropInfo,remaining,cropTime,tickCrops,harvestPlot} from './farming.js';
import {ROOM_GAMES,mountRoomGame} from './roomGames.js';
import {createGameContext} from './gameLevels.js';
import {acquireRoomSpot,promoteRoomSpot,releaseRoomSpot,inspectRoomClaims} from './sceneOccupancy.js';
import {hydrateTown,CAREERS,needs,career,RECIPES,TOURISTS} from './townSimulation.js';
import {createVisitorRuntime} from './visitorRuntime.js';
import {drawOuterSea,drawIsland,drawHarbor,drawBoats,drawHarborForeground} from './harbor.js';
import {createResidentRuntime} from './residentRuntime.js';
import {drawAnimatedCharacter,portraitStyle,characterAssetStatus} from './characters.js';
import {BASE_TOOLS,wornItems,resolveTool,beginToolUse,endToolUse,clearToolLeases,minePrecision} from './equipmentRules.js';
import {garmentAssetStatus} from './garmentArt.js';
import {createEquipmentUI} from './equipmentUI.js';
let serverGather=null,serverCraft=null,serverFarm=null,serverField=null,serverFieldNpc=null,serverResident=null,serverVisitor=null,serverCommerce=null,serverParty=null,serverFishing=null,serverFestival=null,serverCouture=null,serverFireworks=null,serverFacility=null,serverPersonal=null;
let functionalUI=null,specializationUI=null,equipmentUI=null,storiesUI=null,gatheringToolUse=null;
import {ROOMS,roomWalkable} from './rooms.js';
import {decideLocally,GOAL_POINTS,recordMemory} from './npcBrain.js';
import {WORLD,MAP_EXTENT,BUILDINGS,SLOTS,HOTSPOTS,ITEMS,RESIDENTS,SCENE,HARBOR,setWorldTheme,nearestWalkable,unlockRequirement,loadState,saveState,findPath,worldWalkable,sceneWalkable,setWorldDisplayColliders} from './world.js';
const $=id=>document.getElementById(id);
const hudMarkup=new WeakMap();
// Unique SVG clip IDs do not indicate a change in visible HUD content.
function patchHUD(id,html){const el=$(id),signature=html.replace(/art-clip-\d+/g,"art-clip");if(hudMarkup.get(el)===signature)return;el.innerHTML=html;hudMarkup.set(el,signature);}
const residentOrder=RESIDENTS.map((r,i)=>({r,i})).filter(({r})=>r.kind!=='hermes').map(({i})=>i);
let coCreationUI=null,workbenchUI=null,runManagementUI=null,npcAuditUI=null,recruitmentUI=null,recruitmentRuntime=null,fishingUI=null,fishingRuntime=null,nightRuntime=null,festivalRuntime=null,festivalUI=null,coutureRuntime=null,coutureUI=null,fireworksRuntime=null,fireworksUI=null;
let partyGuideUI=null,partyHosting=null;
let contentUI,placementUI=null,collectionsUI=null,journeyUI=null,stewardChat=null,projectUI=null,celebration=null,playerCraftOwner=null,playerPlanStep=null,playerCraftIntent=null;
function hydrateIslandSave(s,forTheme=theme){hydrateTown(s);clearToolLeases(s);syncWonders(s);refreshAchievements(s);hydrateJourney(s);hydrateSpecialization(s);hydratePlacements(s,forTheme);hydrateFunctionalFacilities(s);hydrateNpcProfileAudit(s);return s;}
const canvas=$('game'),ctx=canvas.getContext('2d');
const query=new URLSearchParams(location.search);
let theme=query.get('theme')||document.body.dataset.theme||'pixel';
if(!['pixel','origami'].includes(theme))theme='pixel';
const worldSessionResponse=await fetch('/api/world/session'),worldSession=await worldSessionResponse.json();if(!worldSessionResponse.ok)throw Error(worldSession.error||'无法核对小岛身份');configureWorldSession(worldSession.storageTheme);
const saveTheme=worldSession.storageTheme;
let changingTheme=false,recoveryBoot=true,crossSocialSending=false;
const bootNotice=document.createElement('div');bootNotice.id='islandBootNotice';bootNotice.setAttribute('role','status');bootNotice.textContent='正在核对小岛进度…';document.body.append(bootNotice);$('app').setAttribute('aria-busy','true');
for(const event of ['click','pointerdown','keydown','beforeinput'])$('app').addEventListener(event,e=>{if(recoveryBoot&&!isRecoveryTarget(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
const saves=createSaveClient({storageTheme:saveTheme,loadLocal:loadState,storeLocal:saveState,onStatus:()=>paintSaveStatus(),onRemoteState:(style,next)=>{if(style===saveTheme){state=next;renderUI()}}});
function paintSaveStatus(){
 const status=saves.status(theme),el=$('saveStatus');
 if(el.textContent!==status.message)el.textContent=status.message;el.title='点击管理服务端存档、备份与恢复';el.dataset.status=status.status;
}
configureActionRecovery(()=>saves.acceptServer(theme));
const saveUI=createSaveUI({saves,theme:()=>theme,openModal,toast});
document.body.dataset.theme=theme;
setWorldTheme(theme);
let nightUI;
let state=hydrateIslandSave(await saves.load(theme)),scene=['farm','mine','workshop','tea','gallery'].includes(query.get('scene'))?query.get('scene'):'world',sceneBuilding=query.has('room')?Math.max(0,Math.min(24,Number(query.get('room'))||0)):scene==='tea'?1:scene==='gallery'?7:0,modal=null,zoom=1,canvasW=0,canvasH=0,dpr=1,densityX=1,densityY=1,last=performance.now(),now=0,animationNow=0,toastTimer=0;
theme=state.worldAppearance||state.placementBook?.theme||saveTheme;document.body.dataset.theme=theme;setWorldTheme(theme);
if(query.has('room'))scene=BUILDINGS[sceneBuilding].kind;
let camera={x:scene==='world'?WORLD.width/2:SCENE.width/2,y:scene==='world'?WORLD.height/2:SCENE.height/2};
zoom=scene==='world'?1.55:1;
let actor={x:scene==='world'?state.player.x:500,y:scene==='world'?state.player.y:545,face:1,phase:0,walking:false,path:[],after:null,action:null};
const npcs=RESIDENTS.map((r,i)=>({npcId:i,x:r.start[0],y:r.start[1],face:1,phase:i*1.3,path:[],target:null,think:3+i*2,turn:0,intent:null,aiSource:'local'}));
if(scene==='world')Object.assign(actor,nearestWalkable(actor.x,actor.y));
let runtime=null,visitors=null,roomGame=null,playerFarmClaim=null,playerRoomWait=null;
const soundMixer=getSoundMixer(),worldSound=createWorldSound(soundMixer),soundUI=getSoundUI();
let particles=[],ripples=[],mineMeter=null,aiClock=2,aiCursor=0,aiBusy=false,partyGame=state.partySession||null,partySettling=false;
const images={pixel:new Image(),origami:new Image()};for(const style of ['pixel','origami'])registerThemeArtwork(images[style],terrainOverviewURL(style),style);
const houses={pixel:new Image(),origami:new Image()};for(const style of ['pixel','origami'])registerThemeArtwork(houses[style],HOUSE_ATLAS_BOUNDS[style].src,style);
const sceneImages={};for(const place of ['farm','mine','workshop','tea','gallery'])for(const style of ['pixel','origami']){const key=place+'-'+style;sceneImages[key]=new Image();registerThemeArtwork(sceneImages[key],'/assets/'+key+'.png',style)}
const roomAtlases={pixel:new Image(),origami:new Image()};for(const key of ['pixel','origami'])registerThemeArtwork(roomAtlases[key],'/assets/interiors-'+key+'-v2.png',key);
const roomPacks={pixel:[],origami:[]};for(const style of ['pixel','origami'])for(let i=0;i<7;i++){const image=new Image();registerThemeArtwork(image,'/assets/interiors-'+style+'-pack-'+i+'-v2.png',style);roomPacks[style].push(image)}
const point=(x,y)=>({x,y});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function toast(message){const el=$('toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),2900)}
function log(message,share=true){state.events.unshift(message);state.events=state.events.slice(0,7);if(share)recordMemory(state,message);renderUI();persist()}
function persist(){syncDisplayNavigation();runtime?.syncProjects();state.player={x:actor.x,y:actor.y};saves.enqueue(theme,state);paintSaveStatus()}
function spend(cost){return canSpendResources(state,cost)}
function applyCost(cost){return commitResources(state,{cost,category:'player_action'}).ok}
function give(item,amount){spawnItem(item);state.discovered[item]=true;state.inventory[item]=(state.inventory[item]||0)+amount;recordPlayerGoods(state,item,amount);spawnText(actor.x,actor.y-44,`+${amount} ${ITEMS[item]?.[0]||item}`);renderUI();persist()}
function spawnItem(id,x=actor.x,y=actor.y-30){worldSound.collect();for(let i=0;i<3;i++)particles.push({kind:'item',item:id,x:x+(i-1)*10,y,vx:(i-1)*15,vy:-50,life:1.3,size:20})}
function spawnText(x,y,text){particles.push({x,y,vx:0,vy:-32,life:1,kind:'text',text})}
function burst(x,y,color,count=12){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=25+Math.random()*75;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-25,life:.7+Math.random()*.4,kind:'dot',color,size:2+Math.random()*4})}}
let displaySignature='';
function syncDisplayNavigation(){
 for(const id of Object.keys(state.eventWonders?.pendingDisplays||{}))if(canDisplayWonder(id))setWonderDisplay(state,id,true);
 const places=[...wonderPlacements(state,SLOTS),...decorationColliders(state)],signature=theme+JSON.stringify(places);if(signature===displaySignature)return;displaySignature=signature;setWorldDisplayColliders(places);
 for(const entity of [...(scene==='world'?[actor]:[]),...npcs.filter(n=>n.inside==null),...(visitors?.guests||[]).filter(g=>g.inside==null)])if(entity.path?.length){const end=entity.path.at(-1),next=findPath(entity,end);if(next.length)entity.path=next;}
}
function canDisplayWonder(id){
 const temporary={eventWonders:{...state.eventWonders,displays:{...state.eventWonders?.displays,[id]:true},displayed:id==='seashell_cup'?'seashell_cup':state.eventWonders?.displayed}},p=wonderPlacements(temporary,SLOTS).find(p=>p.id===id);if(!p)return false;
 if(decorationColliders(state).some(o=>Math.abs(o.x-p.x)<o.rx+p.rx+7&&Math.abs(o.y-p.y)<o.ry+p.ry+7))return false;
 return ![...(scene==='world'?[actor]:[]),...npcs.filter(n=>n.inside==null&&n.visible!==false),...(visitors?.guests||[]).filter(g=>g.visible&&g.inside==null)].some(n=>Math.abs(n.x-p.x)<p.rx+13&&Math.abs(n.y-p.y)<p.ry+13);
}
function renderUI(){
 syncDisplayNavigation();
 document.querySelector('.brand b').textContent=state.playerProfile.islandName;if(scene==='world')$('placeName').textContent=state.playerProfile.islandName;
 $('coins').textContent=state.coins;$('day').textContent=state.day;$('builtCount').textContent=Object.keys(state.buildings).length;$('activityCount').textContent=state.activities;if($('businessIncome')){$('businessIncome').textContent=projectedDayAccounts(state).projectedNet;$('businessIncome').dataset.balance=projectedDayAccounts(state).projectedNet<0?'negative':'positive';$('visitorCount').textContent=state.economy.arrivals;$('businessRating').textContent=state.economy.rating.toFixed(1);$('islandQuality').textContent=Math.round(BUILDINGS.reduce((v,b)=>v+effectiveQuality(state.facilities[b.id]),0)/25);$('visitorSummary').textContent=state.economy.active?'岛上有 '+state.economy.active+' 位访客':'渡船定时靠泊 · 按偏好与品质上岛';}
 $('sceneLabel').textContent=scene==='world'?'小岛':scene==='farm'?'农田':scene==='mine'?'矿洞':BUILDINGS[sceneBuilding]?.name||'室内';
 if(runtime){if($('hermesHealth'))$('hermesHealth').textContent=runtime.health.hermes;paintSaveStatus()}
 partyGuideUI?.paint();journeyUI?.render();collectionsUI?.paint();stewardChat?.paint();projectUI?.paint();recruitmentUI?.paint();fishingUI?.paint();
 patchHUD("inventory",['wood','stone','ore','seed','wheat','herb','fish','lantern','tea','meal'].map(id=>'<div class="item" title="'+ITEMS[id][0]+'">'+itemMarkup(id,theme,'resource-icon')+'<b>'+state.inventory[id]+'</b></div>').join(''));
 patchHUD("residentList",residentOrder.map(i=>[RESIDENTS[i],i]).map(([r,i])=>`<div class="resident" data-npc="${i}">${smallPortrait(i)}<div class="resident-copy"><b>${escapeHTML(profile(i).name)}</b><small class="resident-role">${r.job}</small><small class="resident-status">${escapeHTML(npcs[i].status||'准备生活')}</small></div><div class="dot ${npcs[i].aiSource==='deepseek'||npcs[i].aiSource==='hermes'?'connected':''}" title="${npcs[i].aiSource}"></div></div>`).join(''));
 patchHUD("eventFeed",state.events.slice(0,5).map((e,i)=>`<div class="event"><time>${i===0?'刚刚':`第 ${state.day} 天`}</time>${escapeHTML(e)}</div>`).join(''));
 document.querySelectorAll('[data-npc]').forEach(el=>el.onclick=()=>talk(Number(el.dataset.npc)));
}
function profile(i){return i===16?{...RECRUIT_CANDIDATE,...state.recruitment?.active?.profile}:{...RESIDENTS[i],...(state.npcProfiles?.[i]||{})}}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function releasePlayerCraft(){if(playerCraftOwner){if(playerCraftOwner.startsWith('player:'))releaseResources(state,playerCraftOwner);else{const t=state.agentTaskLedger?.find(t=>t.id===playerPlanStep);if(t?.npcId===-1&&t.status==='running'){t.status='queued';delete t.operationId}}playerCraftOwner=null;playerPlanStep=null}}
function openModal(title,subtitle,body,footer=''){advanceModalNavigation();setRecoveryDialog(false);coCreationUI?.stopPreview();endToolUse(state,gatheringToolUse);gatheringToolUse=null;endToolUse(state,mineMeter?.equipment);mineMeter=null;placementUI?.cancel(false);fishingUI?.stopGame();if(roomGame){releasePlayerCraft();releaseRoomSpot('player');}roomGame?.destroy();roomGame=null;modal={title};$('modalRoot').innerHTML=`<div class="modal-overlay"><div class="modal"><div class="modal-head"><div><small>HYPER DIMENSION / ISLAND LIFE</small><h2>${title}</h2><p>${subtitle}</p></div><button class="close" id="closeModal" aria-label="关闭">×</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</div></div>`;$('closeModal').onclick=closeModal;$('modalRoot').querySelector('.modal-overlay').onclick=e=>{if(e.target.classList.contains('modal-overlay'))closeModal()}}
function closeModal(){advanceModalNavigation();setRecoveryDialog(false);coCreationUI?.stopPreview();endToolUse(state,gatheringToolUse);gatheringToolUse=null;endToolUse(state,mineMeter?.equipment);fishingUI?.stopGame();if(state.freshStartPending){state.freshStartPending=false;persist()}if(playerFarmClaim!=null&&!actor.action){runtime?.releaseFarm(playerFarmClaim);playerFarmClaim=null}if(roomGame){releasePlayerCraft();releaseRoomSpot('player');}roomGame?.destroy();roomGame=null;modal=null;mineMeter=null;$('modalRoot').innerHTML=''}
function showGuide(){journeyUI?.open()}

async function setTheme(next){
 if(next===theme||changingTheme)return;
 if(recoveryBoot||saves.blocked(theme)){toast('请先核对当前存档，再切换画风');return;}
 if(actor.action||roomGame||coCreationUI?.busy()||serverGather?.busy()||serverCraft?.busy()||serverField?.busy()||serverParty?.busy()||serverFishing?.busy()||serverFestival?.busy()||serverCouture?.busy()||serverFireworks?.busy()){toast('请先完成当前操作，再切换画风');return;}
 changingTheme=true;placementUI?.cancel(false);toast('正在为同一座小岛更换画风…');
 try{
  await saves.idle(theme);
  await serverFarm?.prepareTheme();await serverFieldNpc?.prepareTheme();await serverResident?.prepareTheme();await serverVisitor?.prepareTheme();
  endMoment(false);stewardChat?.reset();closeModal();releasePlayerStations();persist();await saves.idle(theme);await saves.flush(theme);
  await activateThemeArtwork(next);
  const nextState=await saves.appearance(theme,next);
  theme=next;document.body.dataset.theme=theme;setWorldTheme(theme);syncFarmPlots();state=hydrateIslandSave(nextState,next);
  partyGame=state.partySession||null;partySettling=false;
  Object.assign(actor,nearestWalkable(state.player.x,state.player.y));actor.path=[];actor.action=null;actor.after=null;
  scene='world';zoom=1.55;camera.x=768;camera.y=512;runtime?.reset();visitors?.reset();recruitmentRuntime?.reset();recruitmentUI?.reset();fishingRuntime?.reset();nightRuntime?.reset();festivalRuntime?.reset();coutureRuntime?.reset();fireworksRuntime?.reset();
  renderUI();updateSceneUI();updateThemeButtons();
  await recoverStartup();toast((next==='pixel'?'已切换像素画风':'已切换折纸画风')+' · 小岛进度保持不变');
 }catch(e){toast(e.message||'画风暂未切换，原进度已保留');await activateThemeArtwork(theme);}
 finally{changingTheme=false;}
}

function updateThemeButtons(){applyHUDArt(theme);for(const [id,style] of [['themePixel','pixel'],['themeOrigami','origami']]){$(id).classList.toggle('active',theme===style);$(id).setAttribute('aria-pressed',String(theme===style))}}
function updateSceneUI(){const world=scene==='world';$('mapBadge').classList.toggle('hidden',!world);$('sceneBack').classList.toggle('hidden',world);$('placeName').textContent=world?'晨光岛':scene==='farm'?'沃土农田':scene==='mine'?'星晶矿洞':BUILDINGS[sceneBuilding]?.name||'室内';$('zoomLabel').textContent=`${Math.round(zoom*100)}%`;renderUI()}
function releasePlayerStations(){endToolUse(state,actor.action?.equipment);endToolUse(state,gatheringToolUse);gatheringToolUse=null;releasePlayerCraft();playerCraftIntent=null;playerRoomWait=null;releaseRoomSpot('player');if(playerFarmClaim!=null)runtime?.releaseFarm(playerFarmClaim);playerFarmClaim=null}
function setScene(next,bid=0){placementUI?.cancel(false);closeModal();releasePlayerStations();if(scene==='world')persist();scene=next;sceneBuilding=bid;actor.path=[];actor.after=null;actor.action=null;if(next==='world'){actor.x=state.player.x;actor.y=state.player.y;camera.x=768;camera.y=512}else{actor.x=500;actor.y=545;camera.x=SCENE.width/2;camera.y=SCENE.height/2}zoom=next==='world'?1.55:1;clampCamera();updateSceneUI();toast(next==='farm'?'锄地 → 播种 → 浇水 → 收获':next==='mine'?'点击矿脉，把握挥镐时机':next==='world'?'已返回小岛':`进入${BUILDINGS[bid]?.name||'室内'}`)}
function planMove(target,after=null){if(actor.action)releasePlayerStations();const walk=scene==='world'?worldWalkable:(x,y)=>scene==='farm'||scene==='mine'?sceneWalkable(scene,x,y):roomWalkable(sceneBuilding,x,y);const path=findPath(point(actor.x,actor.y),target,walk,scene==='world'?24:20);if(path.length===0){if(distance(actor,target)<35&&after)after();else toast('暂时无法走到那里');return}actor.path=path;actor.after=after;actor.action=null}
function startAction(type,duration,onContact,onDone,toolUse=null){endToolUse(state,actor.action?.equipment);const equipment=toolUse||beginToolUse(state,type,duration);actor.direction=scene==='world'?(actor.face<0?Math.PI:0):-Math.PI/2;actor.path=[];actor.walking=false;actor.action={type,equipment,roomId:scene==='world'||scene==='farm'||scene==='mine'?null:sceneBuilding,t:0,duration:equipment.duration,contact:false,onContact,onDone:()=>{endToolUse(state,equipment);onDone?.()}};}
function enterHotspot(type){if(type==='farm'||type==='mine')setScene(type);else if(type==='forest')collectWood();else if(type==='plaza')showParty();else if(type==='dock')showBusiness()}
function clickWorld(p){const display=hitDecoration(state,p.x,p.y);if(display){placementUI.card(display.id);return}const mine=HOTSPOTS.find(h=>h.type==='mine'&&distance(p,h)<h.r),farm=HOTSPOTS.find(h=>h.type==='farm'&&distance(p,h)<h.r);if(farm||mine){const h=farm||mine;planMove(h.entry,()=>enterHotspot(h.type));return}
 const forest=HOTSPOTS.find(h=>h.type==='forest'&&distance(p,h)<h.r);if(forest&&p.x<400&&p.y<300){planMove(forest.entry,collectWood);return}
 const dock=HOTSPOTS.find(h=>h.type==='dock'&&distance(p,h)<h.r);if(dock){planMove(dock.entry,()=>showBusiness());return}
 const guest=visitors?.guests.find(g=>g.inside==null&&g.visible&&distance(g,p)<20);if(guest){showGuest(guest);return}
 const nearby=npcs.findIndex(n=>n.visible!==false&&n.inside==null&&distance(n,p)<25);if(nearby>=0){planMove(point(npcs[nearby].x+25,npcs[nearby].y+28),()=>talk(nearby));return}
 const slot=SLOTS.find(s=>Math.abs(p.x-s.x)<s.w/2+8&&Math.abs(p.y-s.y)<s.h/2+14);if(slot){const target=slot.entry;planMove(target,()=>showSlot(slot.id));return}
 const plaza=HOTSPOTS.find(h=>h.type==='plaza'&&distance(p,h)<70);if(plaza){planMove(plaza.entry,()=>showParty());return}
 planMove(p)}
function showSlot(id){
 const b=BUILDINGS[id],active=state.buildings[id]!==undefined,gate=unlockRequirement(id,state);
 if(active){
  const f=state.facilities[id],cost=upgradeCost(f),maintenance=maintenanceCost(f);
  const costs=c=>Object.entries(c).map(([k,n])=>k==='coins'?n+' 岛币':itemIcon(k)+' '+ITEMS[k][0]+' ×'+n).join(' · ');
  openModal(buildingIcon(b.id)+' '+b.name,b.desc,'<div class="hint">品质 '+Math.round(effectiveQuality(f))+' / 上限 '+qualityCap(f)+' · 设施等级 '+f.upgrades+'/4<br>状态 '+Math.round(f.condition)+'% · 接待 '+f.visits+' 次 · 营业 '+f.revenue+' / 运营支出 '+f.operatingCosts+' 岛币</div><p class="mini-explain">居民日常作业逐步提升品质并轻度维护。升级增加品质上限；游客消费产生耗损和运营成本。</p><div class="budget-card"><b>改善设施 · 品质 +10 / 上限 +10</b><p>'+costs(cost)+'</p></div><div class="budget-card"><b>维护设施 · 状态恢复至 100%</b><p>'+costs(maintenance)+'</p></div>','<button class="secondary" id="venueShelf">商品陈列</button><button class="secondary" id="maintainFacility" '+(!canPay(state,maintenance)||f.condition>=100?'disabled':'')+'>维护设施</button><button class="secondary" id="upgradeFacility" '+(!canPay(state,cost)||f.upgrades>=4?'disabled':'')+'>改善设施</button><button class="primary" id="enterSlot">进入室内</button>');
  $('venueShelf').onclick=()=>shopfrontUI.open(id);
  $('upgradeFacility').onclick=async()=>{try{const r=await serverCommerce.command('upgrade',{day:state.day,buildingId:id});log(r.receipt.text);showSlot(id)}catch(e){toast(e.message)}};
  $('maintainFacility').onclick=async()=>{try{const r=await serverCommerce.command('maintain',{day:state.day,buildingId:id});log(r.receipt.text);showSlot(id)}catch(e){toast(e.message)}};
  $('enterSlot').onclick=()=>{closeModal();setScene(b.kind,id)};return
 }
 const cost=b.cost,materials=spend(cost),canOpen=gate.ready&&materials;
 openModal(`${buildingIcon(b.id)} ${b.name}`,b.desc,`<div class="locked-showcase"><div class="locked-orbit">${gate.ready?'✦':'◇'}</div><div><b>${gate.ready?'修复许可已获得':'等待岛屿故事解锁'}</b><p>${gate.text}</p></div></div><div class="hint">这座建筑在岛上已有完整外观。完成条件并交付材料后，居民就能使用它的室内功能。</div><div class="cost-row"><span>${itemIcon('wood')} 木材 ${cost.wood}</span><span>${itemIcon('stone')} 石材 ${cost.stone}</span><span>✦ 岛币 ${cost.coins}</span></div>`,`<button class="secondary" id="closeSlot">稍后再来</button><button class="primary" id="unlockSlot" ${canOpen?'':'disabled'}>修复并开放</button>`);
 $('closeSlot').onclick=closeModal;$('unlockSlot').onclick=()=>build(id,id);
}function build(slotId,buildingId){const b=BUILDINGS[buildingId];if(!unlockRequirement(buildingId,state).ready){toast('解锁条件尚未达成');return}if(!spend(b.cost)){toast('材料不足');return}applyCost(b.cost);closeModal();startAction('build',1.5,()=>{burst(actor.x+20,actor.y-35,'#e9bc64',24)},()=>{state.buildings[slotId]=buildingId;log(`建成${b.name}，居民开始讨论新去处。`);toast(`${b.name}建造完成！`)});renderUI();persist()}
function halfPortrait(i){if(i===15&&state.butlerAvatar!=='default')return avatarPortrait(state.butlerAvatar,theme);return residentPortraitMarkup(i,theme,profile(i).name)}
function residentStage(i){const r=profile(i);return '<aside class="character-stage">'+halfPortrait(i)+'<div class="portrait-caption"><small>'+(r.kind==='hermes'?'HERMES / 岛屿管家':'ISLAND RESIDENT / 岛上居民')+'</small><h3>'+escapeHTML(r.name)+'</h3><p>'+escapeHTML(r.job)+'</p></div></aside>'}
const residentChatUI=createResidentChatUI({state:()=>state,theme:()=>theme,profile,portrait:halfPortrait,openModal,back:talk});
function talk(i){if(i===16){recruitmentUI.open();return}if(RESIDENTS[i].kind==='hermes'){showHermes();return}const r=profile(i),n=needs(i,state),decision=npcs[i].intent,line=decision?.speech||r.dialogue[(state.day+i)%r.dialogue.length],memory=state.npcMemory?.[i]?.at(-1)?.text||'刚来到岛上，还在认识邻居。';
 const required=i===0||i===2,need=i===0?'wheat':'lantern',invited=!!state.partyInvites?.[i],has=availableQuantity(state,need)>0,willingness=relationshipInvitation(state,i,[0,2]);
 const meters=[['体力',n.energy],['饱足',n.hunger],['社交',n.social]].map(([name,value])=>'<label>'+name+' <b>'+Math.round(value)+'</b><meter min="0" max="100" value="'+value+'"></meter></label>').join('');
 const life=residentLifeSummary(state,i,r);
 const body='<div class="conversation-stage">'+residentStage(i)+'<article class="conversation-body"><div class="resident-badges"><span>'+escapeHTML(n.mood)+'</span><span>'+escapeHTML(npcs[i].aiSource==='deepseek'?'DeepSeek 自主决策':r.kind==='hermes'?'Hermes Agent':'岛屿生活')+'</span></div><blockquote class="dialogue-bubble">'+escapeHTML(line)+'</blockquote><dl class="resident-facts"><dt>性格</dt><dd>'+escapeHTML(r.personality)+'</dd><dt>来历</dt><dd>'+escapeHTML(r.backstory)+'</dd><dt>当前行动</dt><dd>'+escapeHTML(npcs[i].status||CAREERS[i].title)+'</dd><dt>生活目标</dt><dd>'+escapeHTML(decision?.reason||r.lifeGoal)+'</dd><dt>生活节奏</dt><dd>'+escapeHTML(life.rhythm)+'<br>'+escapeHTML(life.latest)+'</dd>'+(life.boundaries.length?'<dt>相处边界</dt><dd>'+life.boundaries.map(b=>escapeHTML(profile(b.partnerId).name+'：'+b.text)).join('<br>')+'</dd>':'')+'<dt>近期经历</dt><dd>'+escapeHTML(memory)+'</dd></dl><div class="resident-meters">'+meters+'</div>'+relationshipHTML(i)+(required?'<div class="hint">星灯夜集：'+(invited?'已同意参加':!willingness.ready?escapeHTML(willingness.reason):has?'物资已准备，可以邀请。':'请先准备 '+ITEMS[need][0]+' ×1。')+'</div>':'')+'</article></div>';
 openModal(escapeHTML(r.name),'居民手账 · 工作、生活与共同经历',body,'<button class="secondary" id="talkClose">继续探索</button><button class="secondary" id="residentEdit">查看完整档案</button>'+(r.kind==='hermes'?'<button class="primary" id="stewardWork">委托管家</button>':'')+(required&&!invited?'<button class="primary" id="inviteNpc" '+(has?'':'disabled')+'>邀请参加星灯夜集</button>':''));$('modalRoot').querySelector('.modal').classList.add('resident-modal');$('talkClose').onclick=closeModal;$('residentEdit').onclick=()=>editNpc(i);if(i===15){const b=document.createElement('button');b.className='secondary';b.textContent='选择管家形象';b.onclick=()=>contentUI.wardrobe(true);$('modalRoot').querySelector('.modal-footer').prepend(b)}if(r.kind==='hermes')$('stewardWork').onclick=showHermes;
 const chatButton=document.createElement('button');chatButton.id='residentFreeChat';chatButton.className='primary';chatButton.textContent='聊聊天';chatButton.onclick=()=>residentChatUI.open(i);$('modalRoot').querySelector('.modal-footer').prepend(chatButton);
 const fishingDraft=state.fishingParty?.draft;if(fishingDraft&&eventRequests(fishingDraft).some(p=>p.id===i)){const b=document.createElement('button');b.id='inviteFishingNpc';b.className='primary';b.textContent=fishingDraft.invites[i]?.version===fishingDraft.version?'查看钓鱼派对筹备':'邀请参加钓鱼大会';b.onclick=()=>fishingDraft.invites[i]?.version===fishingDraft.version?fishingUI.open():fishingUI.invite(i);$('modalRoot').querySelector('.modal-footer').append(b)}
 if(location.pathname==='/play'){const b=document.createElement('button');b.id='residentTravelHistoryOpen';b.className='secondary';b.textContent='跨岛相遇手账';b.onclick=()=>openResidentTravelHistory({npcId:i,theme,openModal,back:()=>talk(i),queue:async eventId=>{crossSocialSending=true;try{if(!saves.pendingAction(theme))await saves.idle(theme);persist();const pending=saves.pendingAction(theme);const requestId=pending?.body.kind==='cross-social'&&pending.body.eventId===eventId?pending.body.requestId:crypto.randomUUID();const r=await saves.action(theme,{kind:'cross-social',operation:'queue',eventId,requestId});state=r.state;runtime.refresh();renderUI();}finally{crossSocialSending=false;}}});$('modalRoot').querySelector('.modal-footer').append(b);}
 const storyButton=document.createElement('button');storyButton.id='residentStoriesOpen';storyButton.className='secondary';storyButton.textContent='邻里手账 · 共同经历';storyButton.onclick=()=>storiesUI.open(i);$('modalRoot').querySelector('.modal-footer').append(storyButton);
 if(required&&!invited)$('inviteNpc').onclick=()=>nightUI.invite(i);
}
function favoriteNpc(i){const earned=Object.entries(state.npcRelations[i]||{}).filter(([,r])=>r.interactions>0).sort((a,b)=>b[1].affinity-a[1].affinity);return earned.length?profile(Number(earned[0][0])).name:'尚在结识邻居'}
function showAdmin(){
 const audit=hydrateNpcProfileAudit(state),butler=profile(15);
 const rows=residentOrder.map(i=>{const r=profile(i),memory=state.npcMemory?.[i]?.at(-1)?.text||'暂无岛上经历';return '<button class="admin-card" data-edit-npc="'+i+'"><span class="avatar npc-portrait" style="'+portraitStyle(i,theme)+'"></span><span><b>'+escapeHTML(r.name)+'</b><small>'+escapeHTML(r.job)+' · AI 居民 · 档案 v'+(r.version||0)+'</small><small>'+escapeHTML(npcs[i].status||'准备生活')+' · '+npcs[i].aiSource+'</small><small>亲近的居民 '+escapeHTML(favoriteNpc(i))+' · '+escapeHTML(memory.slice(0,32))+'</small></span><span class="admin-arrow">编辑 ›</span></button>'}).join('');
 openModal('岛屿后台','人格、生活目标、说话风格、真实记忆和关系共同驱动行动。',
 '<div class="hint">模型：DeepSeek V4.1 Flash<br>自动规划每 5 分钟 · 全岛 AI 交谈最多每 10 分钟一次 · 管家自动巡查每 15 分 50 秒<br>DeepSeek：'+escapeHTML(runtime.health.deepseek)+'<br>Hermes：'+escapeHTML(runtime.health.hermes)+'</div>'+
 '<div class="admin-tools"><button class="secondary" id="adminCoCreation">共创工坊 · 课程与作品</button><button class="secondary" id="adminRuntime">自动活动与运行手账</button><button class="secondary" id="adminAudit">档案修改记录 · '+audit.totalCount+' 次</button><button class="secondary" id="adminRecruit">临时伙伴 · 招聘与协作记录</button></div>'+
 '<button class="admin-steward" data-edit-npc="15"><span class="avatar npc-portrait" style="'+portraitStyle(15,theme)+'"></span><span><strong>'+escapeHTML(butler.name)+' · 管家档案</strong><small>Hermes Agent · 档案 v'+(butler.version||0)+'</small><small>'+escapeHTML(butler.personality)+'</small></span><span>编辑 ›</span></button><h3>常住居民 · 15 位</h3><div class="admin-list">'+rows+'</div>');
 document.querySelectorAll('[data-edit-npc]').forEach(b=>b.onclick=()=>editNpc(Number(b.dataset.editNpc)));
 $('adminCoCreation').onclick=()=>coCreationUI.open();$('adminRuntime').onclick=()=>runManagementUI.open();$('adminRecruit').onclick=()=>recruitmentUI.open();$('adminAudit').onclick=()=>npcAuditUI.open();
}
function editNpc(i,options={}){
 const r=profile(i),draft={...r,...(options.fields||{})},capturedState=state,capturedTheme=theme;
 let expectedVersion=npcAuditProfile(state,i).version,busy=false,pendingSaved=false;
 const memories=(state.npcMemory[i]||[]).slice(-5).map(x=>'<li>'+escapeHTML(x.text)+'</li>').join('')||'<li>暂无岛上经历</li>';
 const fields=[['Name','展示姓名','name',16],['Personality','性格','personality',160],['Goal','生活目标','lifeGoal',120],['Speech','说话风格','speechStyle',100]].map(([key,title,field,max])=>'<label>'+title+(key==='Name'?'<input id="editNpc'+key+'" maxlength="'+max+'" value="'+escapeHTML(draft[field]||'')+'"/>':'<textarea rows="3" id="editNpc'+key+'" maxlength="'+max+'">'+escapeHTML(draft[field]||'')+'</textarea>')+'</label>').join('');
 const note=options.restoreFrom?'<p class="npc-edit-note">已填入历史记录 '+escapeHTML(options.restoreFrom)+' 的内容。保存后从当前 v'+expectedVersion+' 生成新版本；尚未改变当前档案。</p>':'<p class="npc-edit-note">当前档案 v'+expectedVersion+' · 内容变化后保留修改前后记录，随本地服务端存档保存。</p>';
 const body='<div class="admin-detail">'+note+'<div class="archive-portrait">'+halfPortrait(i)+'</div><div class="hint"><b>类型：</b>'+r.kind+'　<b>职能：</b>'+escapeHTML(r.job)+'<br><b>来历：</b>'+escapeHTML(r.backstory)+'<br><b>当前行动：</b>'+escapeHTML(npcs[i].status)+'<br><b>亲近的居民：</b>'+escapeHTML(favoriteNpc(i))+'<br>体力 '+Math.round(runtime.person(i).needs.energy)+' · 社交需求 '+Math.round(runtime.person(i).needs.social)+'</div>'+fields+relationshipHTML(i)+'<b>真实近期经历</b><ul>'+memories+'</ul></div>';
 openModal(escapeHTML(r.name),'NPC '+i+' · 姓名与性格修改记录',body,'<button class="secondary" id="backAdmin">'+(i===15?'返回管家':'返回名册')+'</button><button class="secondary" id="npcEditHistory">修改记录</button><button class="primary" id="saveNpc">保存档案</button>');
 $('backAdmin').onclick=i===15?showHermes:showAdmin;$('npcEditHistory').onclick=()=>npcAuditUI.open(i);
 if(i===15){const b=document.createElement('button');b.className='secondary';b.textContent='选择管家形象';b.onclick=()=>contentUI.wardrobe(true);$('modalRoot').querySelector('.modal-footer').prepend(b)}
 const saveButton=$('saveNpc');
 saveButton.onclick=async()=>{
  if(busy||state!==capturedState||theme!==capturedTheme)return;
  const input={name:$('editNpcName').value,personality:$('editNpcPersonality').value,lifeGoal:$('editNpcGoal').value,speechStyle:$('editNpcSpeech').value};
  const result=editNpcProfile(state,i,input,{expectedVersion,requestId:crypto.randomUUID(),restoreFrom:options.restoreFrom||null});
  if(!result.ok){toast(result.reason);return}
  busy=true;saveButton.disabled=true;saveButton.textContent='正在写入存档…';
  expectedVersion=npcAuditProfile(state,i).version;
  if(result.changed){pendingSaved=true;npcs[i].queuedDecision=null;runtime.refresh();log('后台更新了 '+r.name+' 的'+(i===15?'管家':'居民')+'档案，版本 '+expectedVersion+'。')}else persist();
  try{
   await saves.flush(capturedTheme);
   if(state!==capturedState||theme!==capturedTheme||!saveButton.isConnected)return;
   (i===15?showHermes:showAdmin)();
   toast(pendingSaved?'档案与修改记录已写入本地存档':'内容未变化，没有新增修改记录');
  }catch(e){
   if(state===capturedState&&theme===capturedTheme&&saveButton.isConnected)toast('修改保留在当前小岛，磁盘保存尚未完成：'+e.message);
  }finally{
   busy=false;if(saveButton.isConnected){saveButton.disabled=false;saveButton.textContent='保存档案'}
  }
 };
}
function showHermes(){trackJourney(state,'meet');persist();renderUI();stewardChat.open()}
function showBuildMenu(){openModal('建筑图鉴','25 座建筑现已全部开放。居民生产、设施品质与访客评价构成经营循环。',`<div class="building-list">${BUILDINGS.map(b=>{const gate=unlockRequirement(b.id,state),active=state.buildings[b.id]!==undefined;return `<button data-focus="${b.id}">${buildingIcon(b.id)} ${b.name}　${active?'✓ 已开放':gate.ready?'✦ 可修复':'◇ '+gate.text}</button>`}).join('')}</div><p class="mini-explain">点击建筑定位，进入后可体验功能、查看营业数据或改善品质。</p>`);document.querySelectorAll('[data-focus]').forEach(btn=>btn.onclick=()=>{const id=Number(btn.dataset.focus),slot=SLOTS[id];closeModal();setScene('world');camera.x=slot.x;camera.y=slot.y;clampCamera();toast(`已定位：${BUILDINGS[id].name} · 点击建筑查看条件`)})}function showParty(){if(state.fireworksParty?.session?.phase==="running"){fireworksUI.open();return}if(serverFireworks?.busy()){serverFireworks.resume();return}if(state.coutureParty?.session?.phase==="running"){coutureUI.open();return}if(serverCouture?.busy()){serverCouture.resume();return}if(state.festivalParty?.session?.phase==="running"){festivalUI.open();return}if(["checkin","running"].includes(state.fishingParty?.session?.phase)){fishingUI.open();return}if(partySettling){toast('派对正在结算，请稍候');return}
 if(serverFestival?.busy()){serverFestival.resume();return}if(serverFishing?.busy()){serverFishing.resume();return}if(serverParty?.busy()){serverParty.resume();return}
 if(state.partySession&&!state.partyControl){openModal('旧版夜集仍在进行','旧版点击记录无法重放；已有费用与物品记录保留。','<p>可以结束这场旧版活动后继续。结束不追加奖励，也不退回已投入的场地和布置。</p>','<button class="secondary" id="closeLegacyNight">结束旧版夜集</button>');$('closeLegacyNight').onclick=async()=>{try{await serverCommerce.command('party_legacy_close',{day:state.day});partyGame=null;showParty()}catch(e){toast(e.message)}};return}
 partyGuideUI.open();
}
async function startHostedParty(h){
 const t=theme,key=state.saveSlot,enable={night:'night_enable',fishing:'fish_enable',market:'festival_enable',couture:'couture_enable',fireworks:'fireworks_enable'}[h.template];
 await serverCommerce.command(enable);
 const current=state.partyHosting?.active?.find(x=>x.id===h.id),d=hostingDraft(state,h.template);if(theme!==t||state.saveSlot!==key||!current||current.phase!=='armed'||!hostingMatches(state,current))return;
 runtime.refresh();const input={eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d),hostIntentId:h.id,...(h.template==='night'?{fireworks:d.fireworks}:{})},controller={night:serverParty,fishing:serverFishing,market:serverFestival,couture:serverCouture,fireworks:serverFireworks}[h.template];
 await controller.begin(input);
 if(theme!==t||state.saveSlot!==key||!state.partyHosting?.active?.some(x=>x.id===h.id&&x.phase==='started'))return;
 if(h.template==='fishing'){closeModal();const target=fishingSpots()[2];planMove(target,()=>{persist();checkFishingArrival();fishingUI.open();});const end=actor.path.at(-1)||actor;if(Math.hypot(end.x-target.x,end.y-target.y)<=35&&Array.from({length:9},(_,i)=>worldWalkable(end.x+(target.x-end.x)*i/8,end.y+(target.y-end.y)*i/8)).every(Boolean))actor.path.push({...target});}
 if(h.template==='night'){closeModal();const target=HOTSPOTS.find(x=>x.type==='plaza').entry;planMove(target,()=>{persist();serverParty.resume();});}
 persist();
}
async function startLanternGame(){
 if(serverParty.busy()){await serverParty.resume();return}
 try{await serverCommerce.command('party_enable');const d=state.nightParty?.draft;await serverParty.begin({fireworks:d?d.fireworks:Boolean($('partyFireworks')?.checked),...(d?{eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d)}:{})});}
 catch(e){toast(e.message)}
}
function quickGo(type){if(type==='workshop'){setScene('workshop',0);return}if(scene!=='world')setScene('world');const h=HOTSPOTS.find(x=>x.type===type);if(h){planMove(h.entry,()=>enterHotspot(type));camera.x=h.x;camera.y=h.y;clampCamera()}}
const farmPlots=[];function syncFarmPlots(){farmPlots.splice(0,farmPlots.length,...FARM_LAYOUTS[theme])}syncFarmPlots();
const mineRocks=Array.from({length:6},(_,i)=>({x:320+(i%3)*180,y:170+Math.floor(i/3)*145}));
function clickFarm(p){if(actor.action)return;const i=farmPlots.findIndex(q=>insidePlot(q,p));if(i<0){planMove(p);return}planMove(farmPlots[i].entry,()=>farmStep(i))}
function farmStep(i){const plot=state.plots[i];if(plot.stage===3){toast(cropInfo(plot).name+'还需 '+Math.ceil(remaining(plot))+' 秒成熟');return}if(plot.stage===1){if(!runtime.claimFarm(i)){toast('居民或滴灌正在照料这块田，请选另一块田');return}playerFarmClaim=i;openModal('选择本次作物','不同作物各有生长周期 · 通用种子 ×1','<div class="crop-picker">'+Object.entries(CROPS).map(([id,c])=>'<button class="crop-choice" data-crop="'+id+'">'+itemIcon(id)+'<b>'+c.name+'</b><small>'+cropTime(c.seconds)+' · 收获 ×'+c.yield+'</small></button>').join('')+'</div>');document.querySelectorAll('[data-crop]').forEach(btn=>btn.onclick=()=>{const crop=btn.dataset.crop;closeModal();runFarmAction(i,crop)});return}runFarmAction(i)}
function runFarmAction(i,crop=null){const plot=state.plots[i],step=({0:'hoe',1:'sow',2:'water',4:'harvest'})[plot.stage];if(!step)return;if(!runtime.claimFarm(i)){toast('这块田正在作业，请选另一块田');return}playerFarmClaim=i;serverFarm.begin(i,step,crop||plot.crop||state.selectedCrop||'wheat');}
function clickMine(p){const i=mineRocks.findIndex(r=>distance(p,r)<75);if(i<0){planMove(p);return}const r=mineRocks[i];if(state.oreNodes[i].hp<=0){toast('这处矿脉暂时采空，稍后会恢复');return}const near=point(r.x,r.y+76);planMove(near,()=>showMineMeter(i))}
function showMineMeter(i){if(serverFieldNpc?.occupied(i)){toast('居民正在开采这处矿脉，请选择另一处');return}serverField.begin({field:'mine',index:i,itemId:state.mineResource||'ore'});}
function strikeMine(){document.querySelector('#mineStrike')?.click();}
function clickInterior(p){if(actor.action)return;const r=ROOMS[sceneBuilding],f=r.primary;if(p.x>=f.x-25&&p.x<=f.x+f.w+25&&p.y>=f.y-25&&p.y<=f.y+f.h+25){const claim=acquireRoomSpot(sceneBuilding,'player','work');if(!claim){toast('室内客满，请稍后再来');return}planMove(claim.point,()=>{if(claim.role==='queue'){playerRoomWait=sceneBuilding;toast('已排队，工作台空出后会自动前往')}else showInteriorAction()});return}releasePlayerStations();planMove(p)}
function showInteriorAction(){
 if(serverCraft?.busy()){serverCraft.recover();return}
 const id=sceneBuilding,claim=acquireRoomSpot(id,'player','work');
 if(!claim||claim.role!=='work'){playerRoomWait=id;toast('正在等候工作台');return}
 // Walking and queuing outlive save responses. Keep the explicit choice local until it is accepted.
 const intent=playerCraftIntent?.building===id?playerCraftIntent:null;
 const selected=RECIPE_BY_ID[intent?.recipeId||state.craftSelection[id]],recipe=intent&&selected?selected:selected&&selected.building===id&&recipeGate(selected,state).ready?selected:DEFAULT_RECIPES[id];
 const task=playerProjectTask(state,recipe.item,intent?.planTask||playerPlanStep);
 playerCraftIntent=null;closeModal();serverCraft.begin(recipe.id,task?.id||null);
}
function mountServerCraft(ticket,session){
 // The controller has disposed the previous engine; rebuilding the panel is not an exit.
 roomGame=null;
 const id=ticket.building,b=BUILDINGS[id],room=ROOMS[id],recipe=acceptedRecipe(ticket)||RECIPE_BY_ID[ticket.recipeId];
 if(scene==='world'||sceneBuilding!==id)setScene(b.kind,id);
 const materialPanel=WORKSHOP_GAMES[id]?'':'<section class="game-materials">'+itemIcon(recipe.item)+' 制作：'+escapeHTML(recipe.name)+'<button class="secondary recipe-switch" id="switchRecipe">切换配方</button><div class="material-costs">'+Object.entries(recipe.cost).map(([k,n])=>'<span>'+itemIcon(k)+' '+escapeHTML(ITEMS[k][0])+' '+availableQuantity(state,k,ticket.owner)+'/'+n+'</span>').join('')+'</div><p>'+escapeHTML(itemPurpose(recipe.item,state).primary.text)+(ticket.practice?' · 本局为练习，不消耗材料。':' · 按本局开工材料单预留，通关领取后扣除。')+'</p></section>';
 openModal(b.name+' · '+ROOM_GAMES[id].title,room.station,materialPanel+'<div id="roomGameRoot"></div>');
 const panel=$('modalRoot').querySelector('.modal');panel.classList.add('game-modal');if(WORKSHOP_GAMES[id])panel.classList.add('workbench-modal');
 panel.querySelector('.modal-head small').textContent='晨光岛 / 室内工作台';
 const workbench={building:b.name,station:room.station,stock:Object.fromEntries(Object.keys(recipe.cost).map(k=>[k,availableQuantity(state,k,ticket.owner)])),ready:!ticket.practice,canCraft:()=>!ticket.practice,purpose:itemPurpose(recipe.item,state).primary.text,onSwitchRecipe:async()=>{await session.exit();contentUI.recipes(id)}};
 const options={recipe,theme,avatar:state.playerProfile.avatar,workbench,mode:ticket.mode,level:ticket.game.level||{id,seed:ticket.seed,difficulty:ticket.difficulty},resumeGame:ticket.game,onGameEvent:session.trace,onOutcome:session.saveOutcome,onRestart:session.restart,onExit:session.exit,readBest:()=>state.workshopBests?.[id+'-'+ticket.difficulty]||{score:0,stars:0},writeBest:()=>{}};
 const engine=mountRoomGame($('roomGameRoot'),id,session.claim,options);
 if(!WORKSHOP_GAMES[id])$('switchRecipe').onclick=async()=>{await session.exit();contentUI.recipes(id)};
 roomGame={destroy(){engine.destroy();session.exit()},inspect:()=>engine.inspect()};
 const spot=acquireRoomSpot(id,'player','work');if(spot?.role==='work')Object.assign(actor,spot.point);
 return engine;
}

function canvasPoint(e){const rect=canvas.getBoundingClientRect();return point((e.clientX-rect.left)*canvasW/rect.width,(e.clientY-rect.top)*canvasH/rect.height)}
function sceneTransform(){const w=scene==='world'?WORLD.width:SCENE.width,h=scene==='world'?WORLD.height:SCENE.height;return rasterTransform(canvasW,canvasH,w,h,zoom,camera,densityX,densityY)}
function screenToWorld(p){const t=sceneTransform();return point((p.x-t.ox)/t.scale,(p.y-t.oy)/t.scale)}
let pointer={down:false,drag:false,x:0,y:0,lastX:0,lastY:0};
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);const p=canvasPoint(e);pointer={down:true,drag:false,x:p.x,y:p.y,lastX:p.x,lastY:p.y}});
canvas.addEventListener('pointermove',e=>{if(!pointer.down){placementUI?.hover(screenToWorld(canvasPoint(e)));return;}const p=canvasPoint(e);if(Math.hypot(p.x-pointer.x,p.y-pointer.y)>6)pointer.drag=true;if(pointer.drag){const t=sceneTransform();camera.x-=(p.x-pointer.lastX)/t.scale;camera.y-=(p.y-pointer.lastY)/t.scale;clampCamera()}pointer.lastX=p.x;pointer.lastY=p.y});
canvas.addEventListener('pointerup',e=>{if(!pointer.down)return;const dragged=pointer.drag;pointer.down=false;if(dragged||modal)return;const p=screenToWorld(canvasPoint(e));if(placementUI?.active()){placementUI.hover(p);return;}if(scene==='world')clickWorld(p);else if(scene==='farm')clickFarm(p);else if(scene==='mine')clickMine(p);else clickInterior(p)});
function clampCamera(){const w=scene==='world'?WORLD.width:SCENE.width,h=scene==='world'?WORLD.height:SCENE.height,t=sceneTransform(),hw=canvasW/(2*t.scale),hh=canvasH/(2*t.scale);camera.x=Math.max(hw,Math.min(w-hw,camera.x));camera.y=Math.max(hh,Math.min(h-hh,camera.y))}
function setZoom(value,p=point(canvasW/2,canvasH/2)){const before=screenToWorld(p);zoom=Math.max(1,Math.min(3,value));const t=sceneTransform();camera.x=before.x-(p.x-canvasW/2)/t.scale;camera.y=before.y-(p.y-canvasH/2)/t.scale;clampCamera();updateSceneUI()}
canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*(e.deltaY<0?1.1:1/1.1),canvasPoint(e))},{passive:false});
window.addEventListener('keydown',e=>{if(placementUI?.key(e)){e.preventDefault();return;}if(celebration){if(e.key==='Escape')endMoment(false);return}if(e.code==='Space'&&mineMeter){e.preventDefault();strikeMine()}else if(e.key==='Escape'&&modal)closeModal()});
$('themePixel').onclick=()=>setTheme('pixel');$('themeOrigami').onclick=()=>setTheme('origami');$('helpBtn').onclick=showGuide;$('mapBtn').onclick=()=>setScene('world');$('buildBtn').onclick=showBuildMenu;$('partyBtn').onclick=showParty;$('adminBtn').onclick=showAdmin;$('stewardBtn').onclick=()=>{$('residentPanel').classList.add('hidden');$('businessPanel').classList.remove('hidden');showHermes()};$('bagBtn').onclick=()=>contentUI.bag();$('playerBtn').onclick=()=>contentUI.player();$('recipesBtn').onclick=()=>contentUI.recipes();$('gatherBtn').onclick=()=>contentUI.collection();$('zoomIn').onclick=()=>{setZoom(zoom+.15)};$('zoomOut').onclick=()=>{setZoom(zoom-.15)};$('businessBtn').onclick=showBusiness;$('portBtn').onclick=()=>{if(scene!=='world')setScene('world');camera.x=HARBOR.gate.x;camera.y=HARBOR.gate.y;setZoom(1.55);clampCamera();toast('客运码头 · 观察渡船靠泊与游客选择')};$('residentsBtn').onclick=()=>{$('residentPanel').classList.toggle('hidden');$('businessPanel').classList.toggle('hidden',!$('residentPanel').classList.contains('hidden'))};$('residentClose').onclick=()=>{$('residentPanel').classList.add('hidden');$('businessPanel').classList.remove('hidden')};$('businessToggle').onclick=()=>{const panel=$('businessPanel'),folded=panel.classList.toggle('folded');$('businessToggle').textContent=folded?'+':'−';$('businessToggle').setAttribute('aria-expanded',String(!folded));$('businessToggle').setAttribute('aria-label',folded?'展开营业概览':'收起营业概览')};$('questToggle').onclick=()=>document.querySelector('.quest-panel').classList.toggle('folded');$('cameraHome').onclick=()=>{zoom=1;camera.x=scene==='world'?768:500;camera.y=scene==='world'?512:330;clampCamera();updateSceneUI()};$('sceneBack').onclick=()=>setScene('world');document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>quickGo(b.dataset.go));
function resize(){const rect=canvas.getBoundingClientRect();canvasW=rect.width;canvasH=rect.height;const resolution=canvasResolution(canvasW,canvasH,window.devicePixelRatio);dpr=resolution.native;densityX=resolution.x;densityY=resolution.y;canvas.width=resolution.width;canvas.height=resolution.height;ctx.setTransform(densityX,0,0,densityY,0,0);clampCamera()}window.addEventListener('resize',resize);resize();if(window.innerWidth<=620)$('businessToggle').click();updateThemeButtons();renderUI();updateSceneUI();
function rr(x,y,w,h,r,fill,stroke=null){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}}
function ellipse(x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill()}
function line(x1,y1,x2,y2,color,width=2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function poly(points,fill,stroke=null){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))ctx.lineTo(p[0],p[1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}}
function label(text,x,y,color='#fff',size=13,align='center'){ctx.fillStyle=color;ctx.font=theme==='pixel'?`${size}px FusionPixel,sans-serif`:`600 ${size}px "Noto Sans SC",sans-serif`;ctx.textAlign=align;ctx.shadowColor='#1b3b2890';ctx.shadowBlur=4;ctx.fillText(text,x,y);ctx.shadowBlur=0}
function drawWorld(){const img=images[theme];drawOuterSea(ctx,img,theme,animationNow);drawIsland(ctx,img,theme);
 // Light and moving water highlights give the painted background a living surface.
 ctx.save();ctx.globalAlpha=.28;for(let i=0;i<24;i++){const x=(i*179+Math.sin(animationNow*.4+i)*28)%1536,y=34+(i*91)%960;if(!worldWalkable(x,y)){line(x,y,x+14+Math.sin(animationNow*2+i)*8,y-2,'#ffffff',1.5)}}ctx.restore();
 // Entry markers remain tied to tangible locations.
 const marks=[['沃土农田',320,588],['星晶矿洞',1271,291],['星灯派对广场',786,411]];for(const [t,x,y] of marks)nameplate(t,x,y,12,'place');
 // A few animated flags, birds, tree motes and plaza lights.
 for(let i=0;i<8;i++){const x=625+(i%4)*104,y=311+Math.floor(i/4)*323;const swing=Math.sin(animationNow*2+i)*3;line(x,y,x,y-25,'#6b6c42',2);poly([[x,y-24],[x+16+swing,y-19],[x,y-14]],i%2?'#eeba63':'#79b6aa')}
 for(let i=0;i<11;i++){const a=animationNow*.35+i*1.79,x=786+Math.cos(a)*115,y=469+Math.sin(a)*88;ellipse(x,y,2.4,2.4,`rgba(255,238,158,${.35+.22*Math.sin(animationNow*3+i)})`)}
 drawHarbor(ctx,theme,animationNow);drawBoats(ctx,[...(visitors?.boats||[]),...(recruitmentRuntime?.boats||[])],theme,animationNow);nameplate('晨光客运码头',1450,853,12,'place');drawJourneyLandmarks(ctx,state,theme,animationNow,SLOTS,HARBOR);drawSpecializationLandmark(ctx,state,theme,animationNow,SLOTS);
 const entities=[...fireworksPlatforms(state).map(p=>({y:p.y,fireworks:p})),...coutureStage(state).map(p=>({y:p.y-1,couture:p})),...marketStalls(state).map(p=>({y:p.y,market:p})),...state.placedItems.filter(p=>p.version===2).map(p=>({y:p.y,decoration:p})),...wonderPlacements(state,SLOTS).map(p=>({y:p.y,wonder:p})),...SLOTS.map(s=>({y:s.y+s.h/2,slot:s})),...npcs.map((n,i)=>({y:n.y,n,i})).filter(e=>e.n.inside==null&&e.n.visible!==false),...(visitors?.guests||[]).filter(v=>v.visible&&v.inside==null).map(v=>({y:v.y,v})),{y:actor.y,player:true}].sort((a,b)=>a.y-b.y);
 for(const entity of entities){if(entity.fireworks)drawFireworksPlatform(ctx,entity.fireworks,state,theme,animationNow);else if(entity.couture)drawCoutureStage(ctx,entity.couture,theme,animationNow);else if(entity.market)drawMarketStall(ctx,entity.market,state,theme,animationNow);else if(entity.decoration)drawDecoration(ctx,entity.decoration,theme,{s:state,now:animationNow});else if(entity.wonder)drawFishingWonder(ctx,state,theme,SLOTS,animationNow,entity.wonder.id);else if(entity.slot)drawBuilding(entity.slot);else if(entity.v)drawCharacter(entity.v,'#83b3b8',distance(entity.v,actor)<100||entity.v.stage==='waitingBoat'?entity.v.name:'',true,theme==='origami'?.32:.24);else if(entity.player)drawCharacter(actor,theme==='origami'?'#c67170':'#e59755','你',false,theme==='origami'?.32:.24);else drawCharacter(entity.n,profile(entity.i).color,entity.n.meeting||distance(entity.n,actor)<55||entity.i===15?profile(entity.i).name:'',true,theme==='origami'?.32:.24)}
 drawHarborForeground(ctx,[...(visitors?.boats||[]),...(recruitmentRuntime?.boats||[])],theme,animationNow);
 for(const n of npcs)if(n.inside==null&&n.visible!==false)drawSpeech(n);
}
function drawFarm(){const paper=theme==='origami';const sky=ctx.createLinearGradient(0,0,0,660);sky.addColorStop(0,paper?'#e6c6b5':'#a9d8bc');sky.addColorStop(.44,paper?'#f6e5d0':'#d3e6ba');sky.addColorStop(1,paper?'#c7ad8c':'#b7a677');ctx.fillStyle=sky;ctx.fillRect(0,0,1000,660);
 poly([[0,235],[90,215],[250,242],[430,213],[625,231],[810,203],[1000,224],[1000,660],[0,660]],paper?'#d7c5a1':'#7daa69');
 for(let i=0;i<19;i++){const x=i*63+24,y=211+Math.sin(i*1.7)*15;line(x,y,x-5,y-40,paper?'#846a5c':'#5a7649',5);ellipse(x-5,y-44,21,17,paper?'#a5b58c':'#4d9658')}
 poly([[0,254],[1000,254],[1000,660],[0,660]],paper?'#d3b492':'#b39a6d');
 // Farm shed and animated waterwheel.
 rr(25,164,126,135,5,paper?'#e4c1a3':'#af8458','#8b694b');poly([[12,170],[88,100],[165,170]],paper?'#c98280':'#925b3b');rr(60,220,57,79,4,'#6e5845');label('工具棚',88,203,'#fff7dc',16);
 rr(849,200,106,106,5,paper?'#e2bca1':'#ad7d50');poly([[834,205],[900,152],[964,205]],paper?'#cf8984':'#795437');rr(880,231,45,75,3,'#5f5844');label('种子仓',900,225,'#fff9e1',14);
 const wx=834,wy=491;ellipse(wx,wy,58,18,'#526b6199');rr(wx-42,wy-58,84,58,8,'#899e8f','#455b50');ellipse(wx,wy-58,42,13,'#3a808b');ellipse(wx+Math.sin(animationNow*3)*10,wy-59,14,3,'#b8e7e3a6');line(wx-45,wy-62,wx-45,wy-118,'#6f6250',5);line(wx+46,wy-62,wx+46,wy-118,'#6f6250',5);line(wx-45,wy-118,wx+46,wy-118,'#6f6250',4);label('水井',wx,wy+25,'#fbf6da',14);
 // Plots are raised beds with rows, growth, flowers, and an animated irrigation channel.
 for(let i=0;i<8;i++){const q=farmPlots[i],p=state.plots[i];ellipse(q.x+q.w/2,q.y+q.h+13,q.w/2+15,16,'#58654666');rr(q.x-6,q.y-4,q.w+12,q.h+10,11,paper?'#9c775e':'#795438','#533d30');rr(q.x+5,q.y+6,q.w-10,q.h-10,7,paper?'#b9896b':'#8a613c');for(let row=0;row<3;row++){const yy=q.y+21+row*27;line(q.x+18,yy,q.x+q.w-18,yy,paper?'#7b5b4c':'#5d412d',4);for(let col=0;col<5;col++){const xx=q.x+26+col*26;if(p.stage>=2){const grow=p.stage===3?20+Math.sin(animationNow*2+col+i)*2:8;line(xx,yy+4,xx,yy-grow,p.stage===3?'#688648':'#5a974a',2.5);poly([[xx,yy-grow+7],[xx-8,yy-grow+2],[xx-3,yy-grow+13]],'#6fa35c');poly([[xx,yy-grow+6],[xx+8,yy-grow+2],[xx+3,yy-grow+12]],'#80b962');if(p.stage===3)ellipse(xx,yy-grow,3,6,'#e7c859')}else if(p.stage===1)ellipse(xx,yy,3,2,'#c9a37c')}}rr(q.x+q.w-25,q.y-22,30,24,8,'#fff5dbea');label(String(i+1),q.x+q.w-10,q.y-5,'#715944',12)}
 line(173,598,826,598,paper?'#9b8c7c':'#759ca2',17);line(173,598,826,598,'#b4e0db',8);for(let i=0;i<16;i++){const x=170+i*42+Math.sin(animationNow*2+i)*4;line(x,597,x+13,597,'#edf8e5a0',2)}
 label('点击田垄：松土 → 播种 → 浇水 → 收获',500,631,paper?'#6d5146':'#f7edd4',15);
 drawCharacter(actor,paper?'#c67170':'#e59755','你',false,1.18)}
function drawMine(){const paper=theme==='origami';const cave=ctx.createLinearGradient(0,0,0,660);cave.addColorStop(0,paper?'#8d8491':'#293f52');cave.addColorStop(.47,paper?'#6e6878':'#344b58');cave.addColorStop(1,paper?'#7f7683':'#554d4c');ctx.fillStyle=cave;ctx.fillRect(0,0,1000,660);
 for(let i=0;i<18;i++){const x=i*72-20,y=30+(i%3)*20;poly([[x,0],[x+85,0],[x+34,y+80]],paper?'#675b68':'#203640');}
 for(let i=0;i<15;i++){const x=i*87-15;poly([[x,170+(i%3)*34],[x+78,137+(i%2)*50],[x+120,213],[x+86,319],[x+12,322]],paper?'#665d6b':'#2c414a','#75828a70')}
 poly([[0,490],[1000,485],[1000,660],[0,660]],paper?'#695d69':'#4c4843');
 for(let i=0;i<6;i++){const r=mineRocks[i],hp=state.oreNodes[i].hp;ellipse(r.x,r.y+46,71,22,'#171b2b8a');if(hp>0){poly([[r.x-57,r.y+32],[r.x-38,r.y-33],[r.x+9,r.y-50],[r.x+50,r.y-23],[r.x+65,r.y+34]],paper?'#8a7f91':'#596779','#283b4f');for(let j=0;j<hp+1;j++){const xx=r.x-25+j*18,yy=r.y-20+(j%2)*13;poly([[xx,yy+22],[xx+8,yy-3],[xx+18,yy+20]],paper?'#a7d9d3':'#73d5e4');ellipse(xx+8,yy+8,13,20,`rgba(89,221,238,${.13+.08*Math.sin(animationNow*3+j)})`)}}else{poly([[r.x-45,r.y+26],[r.x-12,r.y+5],[r.x+31,r.y+22],[r.x+51,r.y+38]],'#5e5b68');label('已采空',r.x,r.y-8,'#c9b9a7',11)}}
 for(let i=0;i<5;i++){const x=103+i*192;line(x,520,x+65,590,'#4d3d37',7);line(x+85,520,x+150,590,'#4d3d37',7)}line(0,560,1000,560,'#8c6d4e',8);line(0,610,1000,610,'#8c6d4e',8);
 for(let i=0;i<4;i++){const x=145+i*220;line(x,0,x,123,'#6f594b',3);ellipse(x,129,11,15,'#f8cc78');ellipse(x,129,30,34,`rgba(245,191,92,${.14+.04*Math.sin(animationNow*4+i)})`)}
 label('点击矿脉 → 瞄准绿色区挥镐 → 收集矿石',500,641,'#e2d9c4',15);drawCharacter(actor,paper?'#c67170':'#e59755','你',false,1.18)}
function drawInterior(){const b=BUILDINGS[sceneBuilding]||BUILDINGS[0],paper=theme==='origami',kind=scene;
 const colors=kind==='workshop'?['#e9d7bb','#b28e68','#805b44']:kind==='tea'?['#ecdfc6','#a5b58b','#627c64']:['#e5d9d2','#b8a5a2','#806a76'];
 ctx.fillStyle=colors[0];ctx.fillRect(0,0,1000,660);poly([[0,0],[1000,0],[1000,170],[0,170]],paper?'#e0c2bd':colors[1]);poly([[0,170],[1000,170],[950,610],[50,610]],colors[0]);
 for(let i=0;i<11;i++){const x=i*100;line(x,170,x-50,610,'#b8a18d99',2)}for(let y=245;y<660;y+=82)line(0,y,1000,y,'#b8a18d8a',2);
 rr(80,46,150,112,4,'#f6f0d9','#8e725c');rr(93,58,124,86,1,'#a4d8cb');poly([[93,135],[147,75],[217,136]],'#96bd95');line(155,58,155,144,'#eee1c5',5);line(93,100,217,100,'#eee1c5',5);
 rr(796,45,135,119,4,'#f6f0d9','#8e725c');rr(809,58,109,91,1,'#9ecdbd');line(861,58,861,149,'#eee1c5',5);
 // Furnishings have footprints that match indoor collision geometry.
 if(kind==='workshop'){
 rr(224,206,558,173,15,'#654f3f','#44382e');rr(238,196,530,103,9,paper?'#b78d70':'#a4764d','#634c38');for(let i=0;i<4;i++){rr(270+i*125,210,72,56,6,i%2?'#9e714e':'#b88957');label(['🪚','⚒','🔨','🏮'][i],306+i*125,251,'#fff',35)}rr(265,323,38,97,5,'#564536');rr(710,323,38,97,5,'#564536');for(let i=0;i<6;i++){const x=335+i*65;line(x,55,x,104,'#725846',4);label(['🔧','🪓','🪚','🔨','🧰','🪛'][i],x,125,'#fff',24)}rr(51,334,130,158,5,'#78604b');for(let y=349;y<480;y+=50)line(55,y,177,y,'#423b31',4);label('材料架',116,520,'#695342',16);
 }else if(kind==='tea'){
 rr(196,220,610,117,25,'#7a6c52','#4d5944');rr(211,206,580,75,20,paper?'#b6957d':'#9a8964');for(let i=0;i<5;i++){label(i%2?'🍵':'🫖',294+i*100,256,'#fff',31)}for(let i=0;i<4;i++){const x=277+i*157;rr(x,360,72,57,10,'#697959','#4e6146');rr(x+15,416,42,65,7,'#665543')}rr(385,68,230,90,9,'#567659','#3d5b47');label('花茶与岛屿故事',500,120,'#fff3db',24);for(let i=0;i<7;i++){const x=90+i*135;ellipse(x,171+Math.sin(animationNow+i)*2,6,14,'#83a45f')}
 }else{
 for(let i=0;i<4;i++){const x=214+i*155;rr(x,206,118,145,10,'#80736d','#655c5b');rr(x+12,218,94,84,6,'#f3e4c9');label(['🏺','⭐','🎨','📜'][i],x+59,274,'#fff',40);rr(x+17,309,84,29,5,'#604f4d');label(['珍藏','奇观','作品','故事'][i],x+59,329,'#fff',12)}rr(349,70,300,85,10,'#9c7b79');label(`${buildingIcon(b.id)} ${b.name}`,500,123,'#fff5e5',24)
 }
 // Animated light pool and visible target cue.
 const glow=ctx.createRadialGradient(500,359,30,500,359,380);glow.addColorStop(0,`rgba(255,243,190,${.15+.03*Math.sin(animationNow*2)})`);glow.addColorStop(1,'rgba(255,243,190,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,1000,660);
 label(kind==='workshop'?'点击工作台制作':kind==='tea'?'点击茶台调饮':'点击展台布置',500,620,'#745b4f',16);
 drawCharacter(actor,paper?'#c67170':'#e59755','你',false,1.18)
}
function buildingIcon(id){return '<span class="building-thumb" style="background-image:url(/assets/buildings-'+theme+'-front-v2.png);background-position:'+((id%5)*25)+'% '+(Math.floor(id/5)*25)+'%"></span>'}
function nameplate(text,x,y,size=11,kind='npc'){
 ctx.font=theme==='pixel'?size+'px FusionPixel,sans-serif':'600 '+size+'px "Noto Sans SC",sans-serif';const w=Math.ceil(ctx.measureText(text).width)+16,h=size+10;
 if(theme==='pixel'){rr(x-w/2+2,y+2,w,h,0,'#45352770');rr(x-w/2,y,w,h,0,kind==='place'?'#675139':'#eedcb4','#917350');line(x-w/2+3,y+3,x+w/2-3,y+3,'#ffffff48',1);ellipse(x-w/2+4,y+h/2,1,1,'#715238');ellipse(x+w/2-4,y+h/2,1,1,'#715238')}
 else{poly([[x-w/2+3,y+3],[x+w/2+4,y+3],[x+w/2-1,y+h+4],[x-w/2+2,y+h+3]],'#69554a35');poly([[x-w/2,y],[x+w/2-6,y],[x+w/2,y+6],[x+w/2,y+h],[x-w/2+5,y+h],[x-w/2,y+h-5]],kind==='place'?'#b7857f':'#f8e7d6');poly([[x+w/2-6,y],[x+w/2-6,y+6],[x+w/2,y+6]],'#d5b7a3');line(x-w/2+5,y+3,x+w/2-9,y+3,'#fff3e788',1)}
 ctx.shadowBlur=0;ctx.textAlign='center';ctx.fillStyle=kind==='place'?'#fff2cf':theme==='pixel'?'#655035':'#78574f';ctx.fillText(text,x,y+size+3);
}
function drawCharacter(a,color,name,isNpc=false,mult=1){if(celebration)a={...a,walking:false,walkMix:0,action:null};a.appearance=!isNpc?state.playerProfile.avatar:a.npcId===16&&!a.isVisitor?profile(16).appearance:a.npcId===15&&!a.isVisitor&&state.butlerAvatar!=='default'?state.butlerAvatar:null;a.garments=!isNpc?wornItems(state):(a.coutureGarments||[]);a.toolbelt=!isNpc?Object.fromEntries(Object.keys(BASE_TOOLS).map(key=>[key,resolveTool(state,key)?.id])):null;if(!isNpc&&name)name=state.playerProfile.name;drawAnimatedCharacter(ctx,a,theme,color,isNpc,animationNow,mult);if(name)nameplate(name,a.x,a.y-96*mult-22,scene==='world'?12:14);}
function drawSpeech(a){if(!a.speech||(!a.meeting&&a.npcId!==15))return;const size=10,width=138;ctx.font=theme==='pixel'?size+'px FusionPixel,sans-serif':size+'px sans-serif';let rows=[],row='';for(const c of a.speech){if(ctx.measureText(row+c).width>width-16){rows.push(row);row=c}else row+=c}if(row)rows.push(row);rows=rows.slice(0,4);const h=rows.length*14+14,x=a.x-width/2,y=a.y-54-h;rr(x+2,y+3,width,h,theme==='pixel'?0:4,'#393b2c40');rr(x,y,width,h,theme==='pixel'?0:4,theme==='pixel'?'#fff0c9':'#fff3e5',theme==='pixel'?'#997b52':'#ba9990');poly([[a.x-5,y+h],[a.x+4,y+h],[a.x,y+h+7]],theme==='pixel'?'#fff0c9':'#fff3e5');for(let i=0;i<rows.length;i++)label(rows[i],a.x,y+15+i*14,theme==='pixel'?'#6c5236':'#7b5652',size);}

function animatePendingSave(dt){
 animateParticles(dt);
 if(celebration)return;
 visitors?.animatePending(dt);
 if(!actor.action)followPendingPath(actor,dt,scene==='world'?142:130);else actor.action.visualWait=(actor.action.visualWait||0)+dt;
 for(const n of npcs){if(n.indoorActor?.path.length)followPendingPath(n.indoorActor,dt,108);else if(!n.action&&(!n.recruitControlled||!shouldYield(n,[...npcs,...(visitors?.guests||[])])))followPendingPath(n,dt,n.recruitControlled?78:n.partyControlled?65:55+(n.npcId%3)*2);if(n.indoorActor?.action)n.indoorActor.action.visualWait=(n.indoorActor.action.visualWait||0)+dt;if(n.action)n.action.visualWait=(n.action.visualWait||0)+dt;}
}
function update(dt){if(window.hdLanOverlayOpen||recoveryBoot||crossSocialSending||changingTheme)return;serverCommerce?.ensure();serverFacility?.ensure();serverPersonal?.ensure();if(changingTheme||saves.blocked(theme)||state.freshStartPending)return;
 // Visible, unblocked play remains active while durable receipts settle. Only
 // the scene callbacks wait; the clock accumulator is outside the saved state.
 if(!celebration){now+=dt;saves.advanceTime(theme,dt);}
 if(saves.status(theme).capturing||saves.status(theme).reconciling||serverGather?.settling()||serverCraft?.settling()||serverFarm?.settling()||serverField?.settling()||serverFieldNpc?.settling()||serverResident?.settling()||serverVisitor?.settling()||serverCommerce?.settling()||serverParty?.settling()||serverFishing?.settling()||serverFestival?.settling()||serverCouture?.settling()||serverFireworks?.settling()||serverFacility?.settling()||serverPersonal?.settling()){animatePendingSave(dt);return;}if(celebration){updateMoment(dt);return}for(const day of state.commerceControl?.version===1?[]:tickTownEconomy(state,dt))log('第 '+day.day+' 天经营结算：收入 '+day.income+'、支出 '+day.cost+'、净入账 '+day.net+' 岛币。',false);
 if(actor.action){actor.walkMix=(actor.walkMix||0)*Math.exp(-dt*10);const act=actor.action;act.t+=dt;if(!act.contact&&act.t>=act.duration*.52){act.contact=true;worldSound.contact(act);act.onContact?.()}if(act.t>=act.duration){actor.action=null;act.onDone?.()}}else followPath(actor,dt,scene==='world'?142:130);
 for(const event of tickFunctionalFacilities(state,dt,{claimPlot:runtime.claimFarm,releasePlot:runtime.releaseFarm,remoteWater:serverFarm?.beginWater,finishWater:serverFarm?.finishWater}))log(event,false);
 partyHosting?.update(dt);recruitmentRuntime?.update(dt);fishingRuntime?.update(dt);nightRuntime?.update(dt);festivalRuntime?.update(dt);coutureRuntime?.update(dt);fireworksRuntime?.update(dt);runtime.update(dt,now);visitors?.update(dt,now);if(playerRoomWait!=null&&!actor.path.length&&!actor.action&&!modal){const c=promoteRoomSpot('player');if(c){playerRoomWait=null;planMove(c.point,showInteriorAction)}} for(const crop of state.farmControl?.version===1?[]:tickCrops(state,dt))log('第 '+(crop.index+1)+' 块田的'+crop.name+'成熟了。');
 for(const node of state.mineControl?.version===1?[]:state.oreNodes){if(node.hp===0){node.regen-=dt;if(node.regen<=0)node.hp=3}}
 animateParticles(dt);
 if(mineMeter){mineMeter.t+=dt;mineMeter.value=(Math.sin(mineMeter.t*3.6-Math.PI/2)+1)/2;const marker=$('meterMarker');if(marker)marker.style.left=`${mineMeter.value*100}%`}
}
function animateParticles(dt){for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.kind==='dot'?35*dt:0;p.life-=dt}particles=particles.filter(p=>p.life>0);}
function renderParticles(){for(const p of particles){ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,p.life));if(p.kind==='item')drawItem(ctx,p.item,theme,p.x,p.y,p.size);else if(p.kind==='text')label(p.text,p.x,p.y,'#fff9ce',16);else ellipse(p.x,p.y,p.size,p.size,p.color);ctx.restore()}}
function render(){if(dpr!==Math.max(1,window.devicePixelRatio||1))resize();ctx.imageSmoothingEnabled=theme!=='pixel';ctx.imageSmoothingQuality='high';ctx.clearRect(0,0,canvasW,canvasH);const t=sceneTransform();ctx.save();ctx.translate(t.ox,t.oy);ctx.scale(t.scale,t.scale);if(scene==='world')drawWorld();else if(scene==='farm')drawFarmArt();else if(scene==='mine')drawMineArt();else if(scene==='workshop')drawWorkshopArt();else drawRoomArt();renderParticles();if(scene==='world'){drawMomentPerformance(ctx,celebration,theme);placementUI?.draw(ctx);}ctx.restore()}
function frame(ts){const dt=Math.min(.05,Math.max(0,(ts-last)/1000));last=ts;if(!document.hidden)animationNow+=dt;update(dt);worldSound.tick(dt,{scene,building:sceneBuilding,actor,theme,playing:!state.freshStartPending&&!changingTheme&&!saves.blocked(theme)&&!document.hidden,game:!!roomGame||!!document.querySelector('.fishing-stage')||!!partyGame,celebrating:!!celebration});placementUI?.tick(dt);functionalUI?.tick(dt);render();requestAnimationFrame(frame)}runtime=createResidentRuntime({planningRemote:async(operation,args)=>{const inputs={create:['plan_create',{project:args.project}],control:['plan_control',{projectId:args.id,control:args.action}],assign:['plan_assign',{taskId:args.id,assignee:args.npcId}],'task-control':['task_control',{taskId:args.id,control:args.action}],batch:['plan_batch',{plans:args.plans,commands:args.commands,runId:args.runId}]};const [op,body]=inputs[operation]||[];if(!op)throw Error('筹备操作无效');return (await serverCommerce.command(op,{day:state.day,...body})).receipt.details;},recruitmentRemote:offers=>recruitmentUI?.autonomous(offers),npcs,partyRemote:async(p,runId)=>{const operation=({fishing:'fish_steward',night:'night_steward',market:'festival_steward',couture:'couture_steward',fireworks:'fireworks_steward'})[p.template||'fishing'];if(!operation)return{ok:false,title:p.name,reason:'当前活动模板尚未开放'};return(await serverCommerce.command(operation,{day:state.day,runId,proposalId:p.id})).receipt.details;},residentRemote:{begin:(...a)=>serverResident.begin(...a),finish:t=>serverResident.finish(t),cancel:t=>serverResident.cancel(t)},fieldRemote:{begin:(...args)=>serverFieldNpc.begin(...args),finish:t=>serverFieldNpc.finish(t),cancel:t=>serverFieldNpc.cancel(t),occupied:i=>serverFieldNpc?.occupied(i)||false},farmRemote:{begin:(...args)=>serverFarm.beginNpc(...args),finish:t=>serverFarm.finishNpc(t),cancel:t=>serverFarm.cancelTicket(t),occupied:i=>serverFarm?.occupied(i)||false},getState:()=>state,profile,followPath,onChange:()=>{renderUI();nightUI?.paint();festivalUI?.paint();coutureUI?.paint();fireworksUI?.paint();saves.enqueue(theme,state)},onEvent:message=>log(message,false)});
coutureRuntime=createCoutureRuntime({state:()=>state,npcs,resident:()=>runtime,followPath,now:()=>now,player:()=>actor,game:()=>{const g=roomGame?.inspect();return g?.kind==='couture-party'?g.game:state.coutureParty?.session?.game;},occupied:id=>{const b=saves.status(theme).actions;return [b?.active,...Object.values(b?.resident?.leases||{}),...Object.values(b?.farm?.leases||{}),...Object.values(b?.field?.leases||{})].some(t=>t?.actorId===id);}});
fireworksRuntime=createFireworksRuntime({state:()=>state,npcs,resident:()=>runtime,followPath,now:()=>now,player:()=>actor,game:()=>{const g=roomGame?.inspect();return g?.kind==='fireworks-party'?g.game:state.fireworksParty?.session?.game;},occupied:id=>{const b=saves.status(theme).actions;return [b?.active,...Object.values(b?.resident?.leases||{}),...Object.values(b?.farm?.leases||{}),...Object.values(b?.field?.leases||{})].some(t=>t?.actorId===id);}});
visitors=createVisitorRuntime({remote:{ready:()=>serverVisitor?.ready()||false,ensure:()=>serverVisitor?.ensure(),settling:()=>serverVisitor?.settling()||false,command:(...args)=>serverVisitor.command(...args),finish:t=>serverVisitor.finish(t),cancel:t=>serverVisitor.cancel(t),recover:()=>serverVisitor.recover()},getState:()=>state,followPath,harborReserved:()=>recruitmentRuntime?.reserved()||false,extraPassengers:()=>recruitmentRuntime?.passengers()||[],onEvent:message=>log(message,false),onChange:()=>{renderUI();saves.enqueue(theme,state)}});visitors.setEntries(id=>SLOTS[id].entry);
recruitmentRuntime=createRecruitmentRuntime({settleHire:id=>serverCommerce.command('hire_handover',{day:state.day,contractId:id}),state:()=>state,npcs,followPath,resident:()=>runtime,visitors:()=>visitors,onChange:()=>{renderUI();saves.enqueue(theme,state)},onEvent:message=>log(message,false)});recruitmentRuntime.reset();
fishingRuntime=createFishingPartyRuntime({state:()=>state,npcs,followPath,resident:()=>runtime,occupied:id=>{const b=saves.status(theme).actions;return [b?.active,...Object.values(b?.resident?.leases||{}),...Object.values(b?.farm?.leases||{}),...Object.values(b?.field?.leases||{})].some(t=>t?.actorId===id);},onReady:checkFishingArrival,onChange:()=>{renderUI();saves.enqueue(theme,state)}});fishingRuntime.reset();nightRuntime=createNightPartyRuntime({state:()=>state,npcs,resident:()=>runtime,followPath,now:()=>now,occupied:id=>{const b=saves.status(theme).actions;return [b?.active,...Object.values(b?.resident?.leases||{}),...Object.values(b?.farm?.leases||{}),...Object.values(b?.field?.leases||{})].some(t=>t?.actorId===id);}});
festivalRuntime=createFestivalRuntime({state:()=>state,npcs,resident:()=>runtime,followPath,now:()=>now,player:()=>actor,game:()=>{const g=roomGame?.inspect();return g?.kind==='market-party'?g.game:state.festivalParty?.session?.game;},occupied:id=>{const b=saves.status(theme).actions;return [b?.active,...Object.values(b?.resident?.leases||{}),...Object.values(b?.farm?.leases||{}),...Object.values(b?.field?.leases||{})].some(t=>t?.actorId===id);}});
requestAnimationFrame(frame);





function sceneImage(name){const im=sceneImages[`${name}-${theme}`];if(im?.complete&&im.naturalWidth){drawRaster(ctx,im,theme,0,0,SCENE.width,SCENE.height);return true}return false}
function drawFarmArt(){if(!sceneImage('farm')){drawFarm();return}
 for(let i=0;i<farmPlots.length;i++){const q=farmPlots[i],p=state.plots[i],c=cropInfo(p),growth=p.stage===4?1:p.stage===3?Math.min(1,p.growth/c.seconds):0;
 for(let row=0;row<3;row++)for(let col=0;col<5;col++){const pos=plotPoint(q,.15+col*.175,.25+row*.27),x=pos.x,y=pos.y;if(p.stage===0)continue;if(p.stage===1){ellipse(x,y,2.5,1.2,'#624531');continue}const h=p.stage===2?4:6+growth*15;line(x,y,x+Math.sin(animationNow*1.8+i+col)*growth,y-h,'#548a50',1.8);poly([[x,y-h+5],[x-5,y-h+1],[x-2,y-h+9]],'#7ba761');if(growth>.25)poly([[x,y-h+5],[x+5,y-h],[x+2,y-h+9]],'#85b671');if(growth>.6){drawItem(ctx,p.crop||'wheat',theme,x,y-10,10+growth*11);if(p.crop==='tomato'){ellipse(x-3,y-h+5,2.8,3,c.color);ellipse(x+3,y-h+9,2.8,3,c.color)}else if(p.crop==='pumpkin'){ellipse(x,y-3,5+growth*2,4+growth*2,c.color);line(x,y-7,x+2,y-10,'#5b8452',1.5)}else if(p.crop==='herb'){ellipse(x-4,y-h+6,4,2,c.color);ellipse(x+4,y-h+3,4,2,'#a1bf8a')}else{ellipse(x,y-h,2.4,5,c.color);ellipse(x+3,y-h+4,2,3,c.color)}}}
 const anchor=plotPoint(q,.5,1),time=Math.ceil(remaining(p)),text=p.stage===3?c.name+' '+Math.floor(time/60)+':'+String(time%60).padStart(2,'0'):p.stage===4?c.name+' · 可收获':p.stage===2?c.name+' · 待浇水':p.stage===1?'选择作物':'松土';nameplate(text,anchor.x,anchor.y+4,9,'crop');
 if(p.stage===3){rr(anchor.x-27,anchor.y+25,54,3,0,'#493d3480');rr(anchor.x-27,anchor.y+25,54*growth,3,0,c.color)}
 }
 drawFarmIrrigation(ctx,state,theme,farmPlots,animationNow);
 for(let i=0;i<11;i++){const x=136+i*68+Math.sin(animationNow*2+i)*7;line(x,450,x+10,450,'#e9fdfa99',1.5)}label('点击田垄 · 松土 → 选择作物 → 浇水 → 收获',500,626,'#fff7de',15);drawCharacter(actor,theme==='origami'?'#c67170':'#e59755','你',false,1.18);drawResourceWorkers('farm');
}
function drawMineArt(){if(!sceneImage('mine')){drawMine();return}
 for(let i=0;i<mineRocks.length;i++){const r=mineRocks[i],node=state.oreNodes[i];if(node.hp===0){ellipse(r.x,r.y+25,50,30,'#172b3199');poly([[r.x-39,r.y+21],[r.x-20,r.y-2],[r.x+9,r.y+14],[r.x+40,r.y+29]],'#3d505b');label('矿脉恢复中',r.x,r.y-15,'#d8d7c4',10)}else if(node.hp<3){line(r.x-14,r.y-21,r.x+1,r.y+4,'#172b3dbb',3);line(r.x+1,r.y+4,r.x+21,r.y+12,'#172b3dbb',3)}
 if(node.hp>0){drawItem(ctx,state.mineResource||'ore',theme,r.x,r.y,45);ctx.save();ctx.globalAlpha=.28+.18*Math.sin(animationNow*3+i);ellipse(r.x,r.y,19,19,theme==='origami'?'#fff0b5':'#9fe6ff');ctx.restore()}}
 for(let i=0;i<12;i++){const x=95+i*76+Math.sin(animationNow*.5+i)*9,y=168+(i*43)%310+Math.sin(animationNow*1.7+i)*7;ellipse(x,y,1.4,1.4,'#d9f6ed99')}
 label('点击矿脉 · 瞄准绿色区挥镐 · 收集矿石',500,625,'#fff7df',15);drawCharacter(actor,theme==='origami'?'#c67170':'#e59755','你',false,1.18);drawResourceWorkers('mine');
}
function drawWorkshopArt(){drawRoomArt()}
function drawRoomArt(){
 const room=ROOMS[sceneBuilding],pack=roomPacks[theme][Math.floor(sceneBuilding/4)],im=pack.complete&&pack.naturalWidth?pack:roomAtlases[theme],paper=theme==='origami';
 if(im.complete&&im.naturalWidth){const isPack=im===pack,div=isPack?2:5,index=isPack?room.id%4:room.id,w=im.naturalWidth/div,h=im.naturalHeight/div,mx=w*.015,my=h*.025;drawRaster(ctx,im,theme,(index%div)*w+mx,Math.floor(index/div)*h+my,w-mx*2,h-my*2,0,0,1000,660)}else{
 ctx.fillStyle=paper?'#f0e3d0':'#d9c69d';ctx.fillRect(0,0,1000,660);ctx.fillStyle=room.color;ctx.fillRect(0,0,1000,170);
 for(let y=175;y<660;y+=34){line(0,y,1000,y,'#8d735c55',2);for(let x=(Math.floor(y/34)%2)*60;x<1000;x+=120)line(x,y,x,y+34,'#8d735c55',2)}
 for(const f of room.furniture){rr(f.x,f.y,f.w,f.h,3,room.color,'#77634b');rr(f.x+5,f.y+5,f.w-10,f.h-17,2,paper?'#e9d4ba':'#ceb18c')}
 label(room.name,500,100,'#fff4d5',24);
 }
 const f=room.primary;const pulse=.35+.15*Math.sin(animationNow*2);ellipse(f.entry.x,f.entry.y,22,7,'rgba(255,240,171,'+pulse+')');
 for(let i=0;i<7;i++){const x=f.x+30+i*(f.w-40)/7,y=f.y-10-Math.sin(animationNow*1.2+i)*5;const color=room.effect==='water'?'#b2edf4':room.effect==='petals'?'#efc2d8':'#ffe5a6';ellipse(x,y,room.effect==='steam'?4:1.5,room.effect==='steam'?8:1.5,color+'60')}
 animateRoom(room);
 label(room.station+' · 点击家具前往操作',500,620,'#fff4d8',14);drawCharacter(actor,paper?'#c67170':'#e59755','你',false,1.18);drawRoomResidents();
}

// Exact native alpha crops are baked from the atlases and verified by their file hashes.
const houseBounds=Object.fromEntries(['pixel','origami'].map(style=>[style,HOUSE_ATLAS_BOUNDS[style].bounds.map(b=>({...b}))]));
function drawBuilding(s){const b=BUILDINGS[s.id],active=state.buildings[s.id]!==undefined,gate=unlockRequirement(s.id,state),sheet=houses[theme],crop=houseBounds[theme][s.id];
 ctx.save();if(!active){ctx.globalAlpha=gate.ready?.98:.92;ctx.filter=gate.ready?'saturate(.95)':'saturate(.75)'}const w=Math.min(128,s.w+8),h=crop?Math.min(112,w*crop.h/crop.w):90;
 ellipse(s.x,s.y+h/2-5,w*.4,9,'#1c4c2f35');if(crop)drawRaster(ctx,sheet,theme,crop.x,crop.y,crop.w,crop.h,s.x-w/2,s.y-h/2,w,h);ctx.restore();
 if(!active){const x=s.x+w/2-4,y=s.y-h/2+8;rr(x-7,y-7,14,14,theme==='pixel'?0:2,gate.ready?'#e4be75':'#d7c1a0','#927957');label(gate.ready?'✦':'◇',x,y+4,'#725540',10);if(!gate.ready){line(s.x-w/2,s.y+12,s.x-w/2-4,s.y-2,'#76a570',2);ellipse(s.x-w/2-5,s.y-4,4,3,'#90b381')}}
 const occupied=npcs.filter(n=>n.inside===s.id).length+(visitors?.guests||[]).filter(v=>v.inside===s.id).length;verticalBuildingName(b.name,s.x+w/2+6,s.y-h/2+5,occupied);
}

function animateRoom(room){
 const f=room.primary,effect=room.effect;
 if(effect==='water'&&room.id===6){const water={x:f.x+45,y:f.y+25,w:f.w-90,h:Math.min(115,f.h*.5)};ctx.save();ctx.beginPath();ctx.rect(water.x,water.y,water.w,water.h);ctx.clip();for(let i=0;i<8;i++){const x=water.x+12+i*(water.w-24)/8,y=water.y+water.h-((animationNow*14+i*19)%water.h);ellipse(x,y,2.3,2.3,'#d8ffff88')}for(let i=0;i<3;i++){const x=water.x+water.w/2+Math.sin(animationNow*.6+i*2.1)*water.w*.36,y=water.y+25+i*23;ctx.save();ctx.translate(x,y);ctx.scale(Math.cos(animationNow*.6+i*2.1)>0?1:-1,1);ellipse(0,0,7,3,['#edb66a','#b7d9f1','#f0e6b0'][i]);poly([[-6,0],[-12,-4],[-12,4]],'#adc6c9');ctx.restore()}ctx.restore()}
 if(effect==='notes'){for(let i=0;i<3;i++){const x=f.x+f.w*.35+i*40,y=f.y-15-((animationNow*17+i*25)%70);ctx.save();ctx.globalAlpha=.65*(1-((animationNow*17+i*25)%70)/100);label(i%2?'♫':'♪',x,y,'#f2d39e',18);ctx.restore()}}
 if(effect==='steam'){for(let i=0;i<3;i++){const x=f.x+f.w*.55+Math.sin(animationNow*2+i)*5,y=f.y+18-((animationNow*14+i*12)%45);ellipse(x,y,4+i,10,'#fff3d636')}}
 if(effect==='stars'||room.id===8){const x=room.id===8?510:480,y=210;ctx.save();ctx.translate(x,y);ctx.rotate(animationNow*.13);ctx.fillStyle='#ffe5a61c';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,460,-.16,.16);ctx.closePath();ctx.fill();ctx.restore()}
 if(effect==='petals'){for(let i=0;i<6;i++){const x=270+i*82+Math.sin(animationNow*.8+i)*11,y=170+((animationNow*9+i*37)%130);ellipse(x,y,2.5,4,room.id===14?'#b7d98975':'#e8b8c475')}}
 if(effect==='fire'){const glow=ctx.createRadialGradient(820,270,0,820,270,140);glow.addColorStop(0,'rgba(255,171,89,'+(.09+.04*Math.sin(animationNow*7))+')');glow.addColorStop(1,'rgba(255,171,89,0)');ctx.fillStyle=glow;ctx.fillRect(670,130,300,280)}
}

if(query.has('qa'))Object.defineProperty(window,'islandInspect',{value:()=>({cocreation:coCreationUI?.inspect(),sound:soundMixer.inspect(),worldSound:worldSound.inspect(),rendering:{css:[canvasW,canvasH],backing:[canvas.width,canvas.height],density:[densityX,densityY],nativeDpr:dpr,raster:rasterQualityStatus(),terrain:terrainTileStatus(),ocean:seaTileStatus(),artwork:themeArtworkStatus()},partyHosting:state.partyHosting,hostingRuntime:partyHosting?.inspect(),partyGuide:partyGuideUI?.inspect(),theme,saveTheme,now,zoom,scene,sceneBuilding,journey:state.journey,specialization:state.specialization,residentStories:state.residentStories,npcRelations:state.npcRelations,npcConversations:state.npcConversations,chat:state.stewardChat,workProjects:state.workProjects,fireworksParty:state.fireworksParty,fireworksUI:fireworksUI?.inspect(),fireworksAttendance:state.fireworksAttendance,fireworksRuntime:fireworksRuntime?.inspect(),serverFireworks:serverFireworks?.inspect(),coutureParty:state.coutureParty,coutureUI:coutureUI?.inspect(),coutureAttendance:state.coutureAttendance,coutureRuntime:coutureRuntime?.inspect(),serverCouture:serverCouture?.inspect(),festivalParty:state.festivalParty,festivalUI:festivalUI?.inspect(),festivalAttendance:state.festivalAttendance,festivalRuntime:festivalRuntime?.inspect(),serverFestival:serverFestival?.inspect(),fishingParty:state.fishingParty,nightParty:state.nightParty,nightUI:nightUI?.inspect(),nightAttendance:state.nightAttendance,placedItems:state.placedItems,npcNeeds:state.npcNeeds,functionalFacilities:state.functionalFacilities,functionalArt:functionalArtStatus(),placementBook:state.placementBook,placementPreview:placementUI?.inspect(),eventWonders:state.eventWonders,achievementBook:state.achievementBook,fishingGame:fishingUI?.inspect(),recruitment:state.recruitment,recruitBoats:recruitmentRuntime?.boats,agentTaskLedger:state.agentTaskLedger,resourceLedger:state.resourceLedger,celebration:celebration?{id:celebration.id,time:celebration.time}:null,serverCraft:serverCraft?.inspect(),serverFarm:serverFarm?.inspect(),serverField:serverField?.inspect(),serverFieldNpc:serverFieldNpc?.inspect(),serverResident:serverResident?.inspect(),serverVisitor:serverVisitor?.inspect(),visitorControl:state.visitorControl,serverParty:serverParty?.inspect(),serverFishing:serverFishing?.inspect(),fishingAttendance:state.fishingAttendance,fishingControl:state.fishingControl,partyControl:state.partyControl,hireControl:state.hireControl,serverPersonal:serverPersonal?.inspect(),personalControl:state.personalControl,serverCommerce:serverCommerce?.inspect(),serverFacility:serverFacility?.inspect(),facilityControl:state.facilityControl,commerceControl:state.commerceControl,oreNodes:state.oreNodes,mineRocks,roomGame:roomGame?.inspect(),roomHistory:state.roomGames||{},miniGameHistory:state.miniGameHistory||{},characterAssets:characterAssetStatus(),garmentAssets:garmentAssetStatus(),wardrobe:state.wardrobe,toolLoadout:Object.fromEntries(Object.keys(BASE_TOOLS).map(key=>[key,resolveTool(state,key)])),equipmentPreview:equipmentUI?.inspect(),roomClaims:inspectRoomClaims(),plots:state.plots,farmPlots,inventory:state.inventory,playerProfile:state.playerProfile,npcProfiles:state.npcProfiles,npcProfileAudit:state.npcProfileAudit,butlerAvatar:state.butlerAvatar,contentArts:artStatus(),craftHistory:state.craftHistory,recipeSelection:state.craftSelection,mapExtent:MAP_EXTENT,worldExtent:WORLD,harbor:HARBOR,camera:{...camera,width:canvasW,height:canvasH},houseBounds:houseBounds[theme].map(b=>({...b})),actor:{x:actor.x,y:actor.y,path:actor.path.length,action:actor.action?.type,equipment:actor.action?.equipment,duration:actor.action?.duration},slots:SLOTS.map(s=>({...s})),npcs:npcs.map(n=>({id:n.npcId,coutureGarments:n.coutureGarments,partyControlled:n.partyControlled,visible:n.visible,recruitControlled:n.recruitControlled,x:n.x,y:n.y,direction:n.direction,facing:n.facing8,walking:n.walking,next:n.path[0],source:n.aiSource,status:n.status,path:n.path.length,action:n.action?.type,meeting:n.meeting,intent:n.intent,assignment:n.assignment,speech:n.speech,inside:n.inside,indoor:n.indoorActor?{x:n.indoorActor.x,y:n.indoorActor.y,path:n.indoorActor.path.length,direction:n.indoorActor.direction,facing:n.indoorActor.facing8,walking:n.indoorActor.walking,next:n.indoorActor.path[0]}:null,roomQueued:n.roomQueued,career:state.npcCareers[n.npcId]})),visitors:(visitors?.guests||[]).map(g=>({id:g.id,name:g.name,x:g.x,y:g.y,stage:g.stage,visible:g.visible,harborLeg:g.harborLeg,harborQueue:g.harborQueue,next:g.path[0],inside:g.inside,budget:g.budget,spent:g.spent,itinerary:g.itinerary})),boats:visitors?.boats,coins:state.coins,partySession:state.partySession,facilities:state.facilities,economy:state.economy,careers:state.npcCareers,cadence:runtime.cadence,health:{...runtime.health},meetings:[...runtime.meetings.values()].map(m=>({ids:m.ids,phase:m.phase,clock:m.clock,source:m.source}))})});

function drawRoomResidents(){for(const n of npcs){if(n.inside!==sceneBuilding||!n.indoorActor)continue;const a=n.indoorActor;a.action=n.action;drawCharacter(a,profile(n.npcId).color,profile(n.npcId).name,true,1)}for(const v of visitors?.guests||[]){if(v.inside!==sceneBuilding||!v.indoorActor)continue;drawCharacter(v.indoorActor,'#8cb2af',v.name+' · 访客',true,1)}}
function drawResourceWorkers(place){for(const n of npcs){if(n.intent?.goal!==place||!n.action)continue;const index=place==='farm'?n.intent.farmIndex:n.intent.mineIndex;if(index==null||index<0||n.intent.noFarmTask)continue;const p=place==='farm'?farmPlots[index]:mineRocks[index];if(!p)continue;const a=n.resourceActor??={npcId:n.npcId};Object.assign(a,{...(place==='farm'?p.entry:{x:p.x,y:p.y+75}),action:n.action,direction:-Math.PI/2,phase:n.phase,walkMix:0});drawCharacter(a,profile(n.npcId).color,profile(n.npcId).name,true,1)}}
function verticalBuildingName(text,x,y,occupied){const chars=[...text],w=24,h=chars.length*14+14;if(theme==='pixel'){rr(x+2,y+2,w,h,0,'#42362850');rr(x,y,w,h,0,'#eed7a9','#94754d');line(x+3,y+3,x+w-3,y+3,'#fff6d8',1)}else{poly([[x,y],[x+w-5,y],[x+w,y+5],[x+w,y+h],[x+3,y+h],[x,y+h-3]],'#fae9d6','#c8a88e');poly([[x+w-5,y],[x+w-5,y+5],[x+w,y+5]],'#d7b6a0')}for(let i=0;i<chars.length;i++)label(chars[i],x+w/2,y+16+i*14,theme==='pixel'?'#684c32':'#805a52',12);if(occupied)nameplate(String(occupied)+'人',x+w/2,y+h+2,8)}
function relationshipHTML(i){const rows=Object.entries(state.npcRelations[i]||{}).filter(([,r])=>r.interactions>0).sort((a,b)=>b[1].interactions-a[1].interactions);return '<div class="relationship-list"><b>人际关系</b>'+(!rows.length?'<p>尚未形成共同经历。</p>':rows.slice(0,6).map(([id,r])=>'<div class="relationship-row '+(r.tension>12||r.affinity<0?'strained':'')+'"><b>'+escapeHTML(profile(Number(id)).name)+' · '+escapeHTML(r.label||'相识')+'</b><small>亲近 '+r.affinity+' · 信任 '+(r.trust||0)+' · 好感 '+(r.affection||0)+' · 矛盾 '+(r.tension||0)+'</small><p>'+escapeHTML(r.lastEvent||'')+'</p></div>').join(''))+'</div>'}
function showGuest(g){openModal(escapeHTML(g.name)+' · 来访旅人',g.taste,'<div class="hint">'+escapeHTML(g.status)+'<br/>携带预算 '+g.budget+' 岛币 · 已消费 '+g.spent+'<br/>游玩计划：'+g.itinerary.map(id=>BUILDINGS[id].name).join(' → ')+'</div>')}
function showBusiness(){
 const e=state.economy,accounts=projectedDayAccounts(state),budget=townDailyBudget(state),lastDay=e.townDays.at(-1);
 const orders=townOrders(state).map(o=>'<div class="budget-card order-card">'+itemIcon(o.item)+'<div><b>'+o.type+' · '+ITEMS[o.item][0]+' ×'+o.quantity+'</b><p>报价 '+o.reward+' / 交付费 '+o.cost+' / 净收入 +'+o.net+'<br>亲手采集或制作 '+o.personal+'/'+o.quantity+'</p></div><button class="'+(o.done?'secondary':'primary')+'" data-town-order="'+o.slot+'" '+(o.done||o.personal<o.quantity?'disabled':'')+'>'+(o.done?'今日已交付':'交付订单')+'</button></div>').join('');
 const logs=e.visitorLog.slice(0,8).map(x=>'<li>'+escapeHTML(x.text)+'</li>').join('');
 const ledger=e.cashLedger.slice(-12).reverse().map(x=>'<div class="ledger-row"><span>'+escapeHTML(x.note)+'<small>第 '+x.day+' 天 · 收入 '+x.income+' / 支出 '+x.cost+'</small></span><b class="'+(x.net<0?'expense':'')+'">'+(x.net>=0?'+':'')+x.net+'</b></div>').join('')||'<p>新版账本会记录之后的真实收支。</p>';
 const rows=BUILDINGS.map(b=>{const f=state.facilities[b.id];return '<button class="facility-row" data-manage="'+b.id+'">'+buildingIcon(b.id)+'<span><b>'+b.name+'</b><small>品质 '+Math.round(effectiveQuality(f))+'/'+qualityCap(f)+' · 状态 '+Math.round(f.condition)+'% · 接待 '+f.visits+'</small></span></button>'}).join('');
 const packs=SUPPLY_PACKS.map(p=>'<button class="secondary supply-pack" data-supply="'+p.id+'" '+(state.coins<p.coins?'disabled':'')+'><b>'+p.name+' · '+p.coins+' 岛币</b><span>'+Object.entries(p.items).map(([id,n])=>itemIcon(id)+' '+ITEMS[id][0]+' ×'+n).join(' · ')+'</span></button>').join('');
 openModal('晨光岛经营手账','生产、接待、成本与设施再投资','<div class="business-stats"><span>今日收入<b>'+accounts.income+'</b></span><span>今日支出<b>'+accounts.cost+'</b></span><span>结余（含待付岛务）<b>'+accounts.projectedNet+'</b></span><span>累计营业 / 支出<b>'+(e.gross+e.orderIncome)+' / '+e.costs+'</b></span></div><div class="budget-card"><b>今日岛务预算 · '+budget.total+' 岛币</b><p>'+budget.rows.filter(r=>r.coins).map(r=>r.name+' '+r.coins).join(' · ')+'</p><p>'+(lastDay?'上一天收入 '+lastDay.income+' / 支出 '+lastDay.cost+' / 净入账 '+lastDay.net:'当前游戏日结束时结算；今日预算尚待支付 '+accounts.due)+'。</p><p>'+ (budget.policyVersion===12?'当前游戏日沿用原预算；第 '+budget.startsDay+' 天启用 15 分钟经营预算。':'预算按开放设施与体验品质核算；亲手订单、商品和派对带来额外经营收入。')+'</p></div><p class="mini-explain">游客可付费参观观星台、水族馆等体验设施，也会购买真实库存商品。每笔运营或订单交付费为报价的 30%，向上取整。渡船约每 '+ECONOMY_RULES.ferryInterval+' 秒一班，每班两名候选旅人。每个游戏日 '+ECONOMY_RULES.daySeconds+' 秒（'+(ECONOMY_RULES.daySeconds/60)+' 分钟有效游戏时间）；每日岛务、订单与派对次数按游戏日结算。余额紧张时精简运营，保留 '+ECONOMY_RULES.cashReserve+' 币周转，不累积欠费；不扣离线费用。</p><h3>今日岛主订单</h3><p class="mini-explain">每天三项，需使用亲手采集或制作的额度并交付对应库存。居民自动产出、购买补给不增加个人交付额度；每项一天仅结算一次。</p><div class="town-orders">'+orders+'</div><h3>经营补给</h3><div class="supply-grid">'+packs+'</div><h3>收支台账</h3>'+ledger+'<h3>码头见闻</h3><ul class="visitor-events">'+logs+'</ul><h3>设施改善与维护</h3><div class="facility-grid">'+rows+'</div>','<button class="secondary" id="manageShelves">商铺货架</button><button class="primary" id="lookPort">查看码头</button>');
 document.querySelectorAll('[data-town-order]').forEach(b=>b.onclick=async()=>{try{const r=await serverCommerce.command('order',{day:state.day,slot:Number(b.dataset.townOrder)});log(r.receipt.text);showBusiness()}catch(e){toast(e.message)}});
 document.querySelectorAll('[data-manage]').forEach(b=>b.onclick=()=>showSlot(Number(b.dataset.manage)));
 document.querySelectorAll('[data-supply]').forEach(b=>b.onclick=async()=>{try{const r=await serverCommerce.command('supply',{day:state.day,supply:b.dataset.supply});log(r.receipt.text);showBusiness()}catch(e){toast(e.message)}});
  $('manageShelves').onclick=()=>shopfrontUI.open();
  $('lookPort').onclick=()=>{closeModal();$('portBtn').click()}
}


function itemIcon(id){return itemMarkup(id,theme,'inline-icon')}
function collectWood(){contentUI.collection('forest')}
function gatherItem(item){
 closeModal();
 if(item.source==='farm'&&item.id!=='seed'){setScene('farm');state.selectedCrop=CROPS[item.id]?item.id:'wheat';toast(item.id==='seed'?'收获作物可回收种子，研究温室种苗可得到种子 ×2':'选择空田种植'+item.name);return}
 if(item.source==='mine'){state.mineResource=item.id;setScene('mine');toast('当前矿种：'+item.name+'，击碎矿脉取得矿物');return}
 const collect=()=>serverGather.begin(item.id);
 if(item.source==='greenhouse'||item.id==='seed'){setScene(BUILDINGS[14].kind,14);const claim=acquireRoomSpot(14,'player','work');if(claim?.role==='work')planMove(claim.point,collect);else{releaseRoomSpot('player');toast('温室培育台正在使用，请稍后采收')}return}
 if(scene!=='world')setScene('world');const hotspot=HOTSPOTS.find(h=>h.type===(item.source==='forest'?'forest':'dock'));
 planMove(hotspot.entry,()=>{if(item.source!=='fishing'){collect();return}
 serverField.begin({field:'fishing',itemId:item.id});
 });camera.x=hotspot.x;camera.y=hotspot.y;clampCamera();
}
function chooseRecipe(recipe,planTask=null){if(!recipeGate(recipe,state).ready){toast(recipeGate(recipe,state).text);return}state.craftSelection[recipe.building]=recipe.id;persist();closeModal();setScene(BUILDINGS[recipe.building].kind,recipe.building);playerPlanStep=planTask;playerCraftIntent={building:recipe.building,recipeId:recipe.id,planTask};const claim=acquireRoomSpot(recipe.building,'player','work');if(!claim){playerCraftIntent=null;toast('工作台正在使用，请稍后再来');return}planMove(claim.point,()=>{if(claim.role==='queue'){playerRoomWait=recipe.building;toast('已排队，等候工作台')}else showInteriorAction()});}
projectUI=createProjectUI({state:()=>state,theme:()=>theme,openModal,persist,create:input=>runtime.createPreparation(input),manage:(...args)=>runtime.manageProject(...args),refresh:()=>runtime.syncProjects(),toast,craft:chooseRecipe,gather:gatherItem,back:showHermes});
serverPersonal=createServerPersonal({saves,theme:()=>theme,persist,toast,applyState:next=>{state=next;renderUI()}});
const shopfrontUI=createShopfrontUI({state:()=>state,theme:()=>theme,openModal,toast,command:(op,args)=>serverCommerce.command(op,{day:state.day,...args}),back:showBusiness,detail:id=>contentUI.detail(id)});
contentUI=createContentUI({shopfront:id=>shopfrontUI.open(id),deliverOrder:slot=>serverCommerce.command('order',{day:state.day,slot}),command:(operation,args)=>serverPersonal.command(operation,{day:state.day,...args}),state:()=>state,theme:()=>theme,openModal,persist,renderUI,toast,craft:chooseRecipe,gather:gatherItem,butler:()=>editNpc(15),business:showBusiness,party:showParty,fishing:()=>fishingUI.open(),collections:()=>collectionsUI.open(),place:id=>placementUI.start(id),placements:()=>placementUI.inventory(),equipment:()=>equipmentUI.open()});
equipmentUI=createEquipmentUI({command:(operation,args)=>serverPersonal.command(operation,{day:state.day,...args}),state:()=>state,theme:()=>theme,openModal,persist,renderUI,toast,detail:id=>contentUI.detail(id),back:()=>contentUI.player()});
serverGather=createServerGather({saves,theme:()=>theme,persist,toast,
 applyState:next=>{state=next;renderUI();},
 startAnimation:(ticket,done)=>{startAction(ticket.action,ticket.duration,()=>burst(actor.x,actor.y-28,'#a8ce90',14),done,{tool:ticket.tool,owner:ticket.owner,duration:ticket.duration});actor.action.output=ticket.item;},
 stopAnimation:()=>{actor.action=null;actor.path=[];actor.after=null;},
 onGain:receipt=>{const t=receipt.ticket;spawnItem(t.item);spawnText(actor.x,actor.y-45,'+'+t.amount+' '+t.name);log('采集'+t.name+' ×'+t.amount+'。');},
 onRelease:()=>releaseRoomSpot('player')
});
serverCraft=createServerCraft({saves,theme:()=>theme,persist,toast,applyState:next=>{state=next;renderUI();},mount:mountServerCraft,
 closeGame:()=>{roomGame=null;closeModal();releaseRoomSpot('player');},
 animate:ticket=>new Promise(resolve=>{roomGame=null;closeModal();acquireRoomSpot(ticket.building,'player','work');const room=ROOMS[ticket.building];startAction(room.action,ticket.duration,()=>burst(actor.x,actor.y-45,room.color,20),resolve,{tool:ticket.tool,owner:ticket.owner,duration:ticket.duration});actor.action.output=ticket.item;}),
 onComplete:receipt=>{const t=receipt.ticket;if(receipt.outcome==='finished'){spawnItem(t.item);spawnText(actor.x,actor.y-44,'+1 '+t.name);log('在'+BUILDINGS[t.building].name+'制作'+t.name+'，品质 '+receipt.quality+'。');toast('制作完成 · '+t.name+' ×1');contentUI.detail(t.item,{crafted:true})}else toast(receipt.outcome==='practiced'?'练习已完成，本局未消耗材料':'已取消制作，材料已解除预留');renderUI();}
});
serverFarm=createServerFarm({saves,theme:()=>theme,persist,toast,applyState:next=>{state=next;renderUI();},
 startAnimation:(t,done)=>{if(scene!=='farm')setScene('farm');runtime.claimFarm(t.index);playerFarmClaim=t.index;const q=farmPlots[t.index];const run=()=>{actor.face=1;startAction(t.action,t.duration,()=>{const p=plotPoint(q,.5,.65);burst(p.x,p.y,t.step==='water'?'#93cdf0':t.step==='harvest'?CROPS[t.crop].color:'#90734e',18)},done,{tool:t.tool,owner:t.owner,duration:t.duration});actor.action.output=t.step==='harvest'?t.item:null};if(distance(actor,q.entry)<35)run();else planMove(q.entry,run);},
 stopAnimation:()=>{actor.action=null;actor.path=[];actor.after=null;},onRelease:releasePlayerStations,onWaterRelease:(index,id)=>runtime.releaseFarm(index,'facility:'+id),
 onReceipt:r=>{if(r.outcome==='finished'){if(r.ticket.step==='harvest'){const q=farmPlots[r.ticket.index],p=plotPoint(q,.5,.65);spawnItem(r.ticket.item,p.x,p.y);spawnText(p.x,p.y-20,'+'+CROPS[r.ticket.crop].yield+' '+CROPS[r.ticket.crop].name);}log(r.text);toast(r.text);}else toast(r.text);renderUI();}
});
function mountServerField(ticket,controls){
 roomGame=null;if(ticket.field==='mine'&&scene!=='mine')setScene('mine');openModal(ticket.name,ticket.field==='mine'?'观察矿脉、精确挥镐，完成动作后收集矿物。':'瞄准抛竿、等待咬钩、跟随鱼影收放线，确认后收取1份海产。','<div id="roomGameRoot"></div>');
 $('modalRoot').querySelector('.modal').classList.add('game-modal','workbench-modal');
 const raw=ticket.field==='mine'?mountMiningGame($('roomGameRoot'),ticket,controls,theme):mountWorkshopGame($('roomGameRoot'),16,controls.claim,{theme,avatar:state.playerProfile.avatar,catchItem:ticket.item,equipment:ticket.tool,level:{id:16,seed:ticket.seed,difficulty:ticket.difficulty},mode:ticket.mode,resumeGame:ticket.game,onGameEvent:controls.trace,onOutcome:controls.saveOutcome,onExit:controls.exit,onRestart:controls.restart,readBest:()=>state.workshopBests?.['field-fishing-'+ticket.difficulty]||{score:0,stars:0},writeBest:()=>{}});
 roomGame={inspect:()=>raw.inspect(),destroy:()=>serverField.exit()};return raw;
}
serverField=createServerCraft({saves,theme:()=>theme,persist,toast,kind:'field',idPrefix:'field',noun:'采集',beginInput:(input,task,mode)=>({...input,actor:'player',mode}),restartInput:t=>({field:t.field,index:t.index,itemId:t.item}),shouldRecover:(active,pending)=>!(pending?.body?.actor==='npc'||saves.status(theme).actions?.field?.leases?.[pending?.body?.requestId]),applyState:next=>{state=next;renderUI()},mount:mountServerField,closeGame:()=>{roomGame=null;closeModal()},
 animate:t=>new Promise(done=>{roomGame=null;closeModal();const run=()=>{startAction(t.action,t.duration,()=>{const p=t.field==='mine'?mineRocks[t.index]:actor;burst(p.x,p.y,t.field==='mine'?'#84d6dc':'#9bcbd8',20)},done,{tool:t.tool,owner:t.owner,duration:t.duration});actor.action.output=t.item;};if(t.field==='mine'){if(scene!=='mine')setScene('mine');const p=mineRocks[t.index];actor.face=p.x>=actor.x?1:-1;planMove({x:p.x,y:p.y+76},run);}else run();}),
 onComplete:r=>{if(r.outcome==='finished'){const p=r.ticket.field==='mine'?mineRocks[r.ticket.index]:actor;for(const [id,n]of Object.entries(r.gain)){spawnItem(id,p.x,p.y);spawnText(p.x,p.y-35,'+'+n+' '+ITEMS[id][0]);}log(r.text);toast(r.text);}else toast(r.text);renderUI();}
});
serverFieldNpc=createServerFieldNpc({saves,theme:()=>theme,persist,toast,applyState:next=>{state=next;renderUI()}});
serverResident=createServerResident({saves,theme:()=>theme,persist,toast,applyState:next=>{state=next;renderUI()}});
serverCommerce=createServerCommerce({saves,theme:()=>theme,persist,toast,applyState:next=>{state=next;renderUI()}});
nightUI=createNightPartyUI({state:()=>state,theme:()=>theme,profile,portrait:halfPortrait,openModal,toast,persist,command:(op,args={})=>serverCommerce.command(op,{day:state.day,...args}),back:showParty,start:startLanternGame,collections:()=>collectionsUI.open()});
serverParty=createServerCraft({saves,theme:()=>theme,persist,toast,kind:'party',idPrefix:'party',noun:'相聚',beginInput:input=>({fireworks:!!input.fireworks,...(input.hostIntentId?{hostIntentId:input.hostIntentId}:{}),...(input.eventId?{eventId:input.eventId,eventVersion:input.eventVersion,eventStamp:input.eventStamp}:{})}),restartInput:t=>({fireworks:t.fireworks,...(t.design?{eventId:t.design.id,eventVersion:t.design.version,eventStamp:t.design.stamp}:{})}),
 applyState:next=>{state=next;partyGame=next.partySession||null;renderUI()},
 mount:(ticket,controls)=>{roomGame=null;openModal(ticket.name+' · 四盏星灯','本场进度已保存在小岛，收起页面后可继续相聚。','<div id="nightPartyRoot"></div>');$('modalRoot').querySelector('.modal').classList.add('night-party-modal');
  const raw=mountNightParty($('nightPartyRoot'),ticket,controls,{theme,arrived:()=>nightPartyArrived(state),sound:s=>soundMixer.play(s),effect:precise=>burst(actor.x,actor.y-75,precise?'#ffe9a0':'#c2e5d4',20)});roomGame={inspect:raw.inspect,destroy:raw.destroy};return raw;},
 closeGame:()=>{roomGame=null;closeModal();partyGame=state.partySession||null;partySettling=false;},
 animate:t=>new Promise(done=>{roomGame=null;closeModal();partySettling=true;startAction('celebrate',t.duration,()=>{burst(actor.x,actor.y-65,'#f9d378',35);if(t.fireworks){burst(actor.x-70,actor.y-135,'#ec97aa',28);burst(actor.x+70,actor.y-155,'#94dbe0',28)}},done);}),
 onComplete:r=>{partyGame=null;partySettling=false;log(r.text);toast(r.text);renderUI();nightUI.open();}
});

let fishingArrivalPending=false,fishingArrivalRetry=0;
async function checkFishingArrival(){
 const g=state.fishingParty?.session;if(!state.fishingControl||g?.phase!=='checkin'||!state.fishingAttendance||fishingArrivalPending||Date.now()<fishingArrivalRetry)return;
 const people=state.fishingAttendance.people,spot=fishingSpots()[2];if(scene==='world'&&Math.hypot(actor.x-spot.x,actor.y-spot.y)<=8)people[-1]={x:actor.x,y:actor.y,inside:null,arrived:true};
 else people[-1]={x:actor.x,y:actor.y,inside:scene==='world'?null:sceneBuilding,arrived:false};
 if(!people[-1]?.arrived||g.participants.some(p=>!people[p.id]?.arrived))return;runtime.refresh();
 fishingArrivalPending=true;try{await serverCommerce.command('fish_checkin',{day:state.day,eventId:g.id});await serverFishing.resume();}catch(e){fishingArrivalRetry=Date.now()+3000;if(e.code!=='fishing_arrival')toast(e.message);}finally{fishingArrivalPending=false;}
}
serverFishing=createServerCraft({saves,theme:()=>theme,persist,toast,kind:'fishing',idPrefix:'fishing',noun:'垂钓',beginInput:input=>({eventId:input.eventId,eventVersion:input.eventVersion,...(input.hostIntentId?{hostIntentId:input.hostIntentId,eventStamp:input.eventStamp}:{})}),restartInput:t=>({eventId:t.eventId,eventVersion:t.eventVersion}),
 exitMessage:'开场用品已投入本场。结束只解除渔竿与海风旗预留，不发完成奖励。',recoveryMessage:'服务端保留本场种子、垂钓进度与钓具预留，继续不重新收场地费。',
 applyState:next=>{state=next;renderUI();},
 mount:(ticket,controls)=>fishingUI.mount(ticket,controls),
 closeGame:()=>{closeModal();partySettling=false;},
 animate:t=>new Promise(done=>{fishingUI.stopGame();closeModal();partySettling=true;startAction('celebrate',t.duration,()=>burst(actor.x,actor.y-70,'#f9d378',35),done);}),
 onComplete:r=>{partySettling=false;log(r.text);toast(r.text);fishingRuntime.release();renderUI();fishingUI.open();}
});
festivalUI=createFestivalUI({state:()=>state,theme:()=>theme,profile,portrait:halfPortrait,openModal,toast,persist,command:(op,args={})=>serverCommerce.command(op,{day:state.day,...args}),back:showParty,play:{resume:()=>serverFestival.resume()},collections:()=>collectionsUI.open(),start:async d=>{try{if(serverFestival.busy()){await serverFestival.resume();return;}await serverFestival.begin({eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d)});}catch(e){toast(e.message);}}});
serverFestival=createServerCraft({saves,theme:()=>theme,persist:()=>{runtime.refresh();persist();},toast,kind:'festival',idPrefix:'festival',noun:'集市',beginInput:input=>({...input}),restartInput:t=>({eventId:t.eventId,eventVersion:t.eventVersion,eventStamp:t.eventStamp}),
 exitMessage:'未售商品会退回，器具解除预留；已售商品和12岛币场地费不退，本场不发完成收益。',recoveryMessage:'本场订单、售出商品和未售库存保存在服务端；继续不重收场地费，结束只退回未售商品。',
 applyState:next=>{state=next;renderUI();},
 mount:(ticket,controls)=>{
  roomGame=null;const g=state.festivalParty.session;if(scene!=='world')setScene('world');
  if(distance(actor,g.layout.player)>6){planMove(g.layout.player);const end=actor.path.at(-1)||actor;if(Math.hypot(end.x-g.layout.player.x,end.y-g.layout.player.y)<=35&&Array.from({length:9},(_,i)=>worldWalkable(end.x+(g.layout.player.x-end.x)*i/8,end.y+(g.layout.player.y-end.y)*i/8)).every(Boolean))actor.path.push({...g.layout.player});}
  openModal(ticket.name+' · 集市营业','调整陈列，核对订单，沿道路到摊后交付。收起页面会保留本场进度。','<div id="marketPartyRoot"></div>');$('modalRoot').querySelector('.modal').classList.add('market-modal');
  const raw=mountMarket($('marketPartyRoot'),ticket,controls,{theme,profile,portrait:halfPortrait,ready:()=>festivalRuntime.ready(),arrived:o=>festivalRuntime.arrived(o),sound:s=>soundMixer.play(s),burst:()=>burst(actor.x,actor.y-55,'#f1d587',12)});roomGame={inspect:raw.inspect,destroy:raw.destroy};return raw;
 },
 closeGame:()=>{roomGame=null;closeModal();partySettling=false;},
 animate:t=>new Promise(done=>{roomGame=null;closeModal();partySettling=true;startAction('celebrate',t.duration,()=>burst(actor.x,actor.y-70,'#f8d68d',35),done);}),
 onComplete:r=>{partySettling=false;log(r.text);toast(r.text);festivalRuntime.release();renderUI();festivalUI.open();}
});
coutureUI=createCoutureUI({state:()=>state,theme:()=>theme,profile,portrait:halfPortrait,openModal,toast,persist,command:(op,args={})=>serverCommerce.command(op,{day:state.day,...args}),back:showParty,play:{resume:()=>serverCouture.resume()},collections:()=>collectionsUI.open(),start:async d=>{try{if(serverCouture.busy()){await serverCouture.resume();return;}await serverCouture.begin({eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d)});}catch(e){toast(e.message);}}});
serverCouture=createServerCraft({saves,theme:()=>theme,persist:()=>{runtime.refresh();persist();},toast,kind:'couture',idPrefix:'couture',noun:'穿搭大会',beginInput:input=>({...input}),restartInput:t=>({eventId:t.eventId,eventVersion:t.eventVersion,eventStamp:t.eventStamp}),
 exitMessage:'服装与活动旗解除预留；12岛币场地费、纤维与茶叶不退，本场不发完成收益。',
 recoveryMessage:'服务器保留同一组主题、真实服装、亮拍和评审结果；继续不重收场地费，结束归还服装。',
 applyState:next=>{state=next;renderUI();},
 mount:(ticket,controls)=>{
  roomGame=null;const g=state.coutureParty.session;if(scene!=='world')setScene('world');
  if(distance(actor,g.layout.player)>6){planMove(g.layout.player);const end=actor.path.at(-1)||actor;if(Math.hypot(end.x-g.layout.player.x,end.y-g.layout.player.y)<=35&&Array.from({length:9},(_,i)=>worldWalkable(end.x+(g.layout.player.x-end.x)*i/8,end.y+(g.layout.player.y-end.y)*i/8)).every(Boolean))actor.path.push({...g.layout.player});}
  openModal(ticket.name+' · 海岛秀场','先满足场合要求，再沿秀道登台。收起页面会保留本场进度。','<div id="couturePartyRoot"></div>');$('modalRoot').querySelector('.modal').classList.add('couture-modal');
  const raw=mountCouture($('couturePartyRoot'),ticket,controls,{theme,profile,portrait:halfPortrait,ready:()=>coutureRuntime.ready(),arrived:id=>coutureRuntime.arrived(id),model:id=>npcs[id],layout:g.layout,sound:s=>soundMixer.play(s),burst:()=>burst(actor.x,actor.y-55,'#f1d587',12)});roomGame={inspect:raw.inspect,destroy:raw.destroy};return raw;
 },
 closeGame:()=>{roomGame=null;closeModal();partySettling=false;},
 animate:t=>new Promise(done=>{roomGame=null;closeModal();partySettling=true;startAction('celebrate',t.duration,()=>burst(actor.x,actor.y-70,'#f8d68d',35),done);}),
 onComplete:r=>{partySettling=false;log(r.text);toast(r.text);coutureRuntime.release();renderUI();coutureUI.open();}
});
fireworksUI=createFireworksUI({state:()=>state,theme:()=>theme,profile,portrait:halfPortrait,openModal,toast,persist,command:(op,args={})=>serverCommerce.command(op,{day:state.day,...args}),back:showParty,play:{resume:()=>serverFireworks.resume()},collections:()=>collectionsUI.open(),start:async d=>{try{if(serverFireworks.busy()){await serverFireworks.resume();return;}await serverFireworks.begin({eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d)});}catch(e){toast(e.message);}}});
serverFireworks=createServerCraft({saves,theme:()=>theme,persist:()=>{runtime.refresh();persist();},toast,kind:'fireworks',idPrefix:'fireworks',noun:'烟花大会',beginInput:input=>({...input}),restartInput:t=>({eventId:t.eventId,eventVersion:t.eventVersion,eventStamp:t.eventStamp}),
 exitMessage:'未发射烟花与海风旗解除预留；14岛币场地费、实际发射烟花与茶叶不退，本场不发完成收益。',
 recoveryMessage:'同一组风向、编排、真实发射和成绩继续保留；按原编号继续不重收场地费，结束归还未发射者。',
 applyState:next=>{state=next;renderUI();},
 mount:(ticket,controls)=>{
  roomGame=null;const g=state.fireworksParty.session;if(scene!=='world')setScene('world');
  if(distance(actor,g.layout.player)>6){planMove(g.layout.player);const end=actor.path.at(-1)||actor;if(Math.hypot(end.x-g.layout.player.x,end.y-g.layout.player.y)<=35&&Array.from({length:9},(_,i)=>worldWalkable(end.x+(g.layout.player.x-end.x)*i/8,end.y+(g.layout.player.y-end.y)*i/8)).every(Boolean))actor.path.push({...g.layout.player});}
  openModal(ticket.name+' · 星海演出','编排颜色、形状和发射位，根据风向瞄准，在节拍里绽放。收起页面会保留本场进度。','<div id="fireworksPartyRoot"></div>');$('modalRoot').querySelector('.modal').classList.add('fireworks-modal');
  const raw=mountFireworks($('fireworksPartyRoot'),ticket,controls,{theme,profile,portrait:halfPortrait,ready:()=>fireworksRuntime.ready(),participants:g.participants.map(p=>p.id),present:id=>state.fireworksAttendance?.people[id]?.arrived===true,sound:s=>soundMixer.play(s),burst:()=>burst(actor.x,actor.y-55,'#f1d587',12)});roomGame={inspect:raw.inspect,destroy:raw.destroy};return raw;
 },
 closeGame:()=>{roomGame=null;closeModal();partySettling=false;},
 animate:t=>new Promise(done=>{roomGame=null;closeModal();partySettling=true;startAction('celebrate',t.duration,()=>burst(actor.x,actor.y-70,'#f8d68d',35),done);}),
 onComplete:r=>{partySettling=false;log(r.text);toast(r.text);fireworksRuntime.release();renderUI();fireworksUI.open();}
});
serverVisitor=createServerVisitor({saves,theme:()=>theme,persist,toast,applyState:next=>{state=next;renderUI()},restore:()=>visitors.reset()});
artReady.then(()=>{applyHUDArt(theme);renderUI()});

function smallPortrait(i){return i===15&&state.butlerAvatar!=='default'?'<div class="avatar">'+avatarThumbnail(state.butlerAvatar,theme)+'</div>':'<div class="avatar npc-portrait" style="'+portraitStyle(i,theme)+'"></div>'}

// Journal actions reuse real gathering, farming, recipe and invitation flows.
function journeyAction(action){
 if(actor.action||partySettling){toast('等当前动作完成后，再去下一站。');return}
 closeModal();
 if(action==='steward'){showHermes();return}
 if(action==='farm'){setScene('farm');state.selectedCrop='wheat';toast('点击田地：松土、播种小麦、浇水；生长时可以去做别的事。');return}
 if(action==='wood'){gatherItem(RAW_MATERIALS.find(x=>x.id==='wood'));return}
 if(action==='mine'){state.mineResource='ore';setScene('mine');return}
 if(action==='lantern'){contentUI.detail('lantern');return}
 if(action==='business'){showBusiness();return}
 if(action==='invite'){talk(!state.partyInvites?.[0]?0:2);return}
 if(action==='party'){showParty();return}
}
function beginMoment(id){
 const custom=typeof id==='object'?specializationMoment(state,id.path):null,m=custom||MOMENTS.find(x=>x.id===id),j=refreshJourney(state);
 if(!m||!custom&&(!j.ready[id]||j.claimed[id])||celebration)return;
 id=m.id;
 if(actor.action||partySettling){toast('这一刻已经记在手账，等当前动作完成就可以观看。');return}
 closeModal();if(scene!=='world')setScene('world');actor.path=[];actor.after=null;releasePlayerStations();
 const savedCamera={...camera,zoom},center=custom?{x:SLOTS[SPECIALIZATIONS.find(p=>p.id===custom.path).building].x,y:SLOTS[SPECIALIZATIONS.find(p=>p.id===custom.path).building].y+45}:id==='signature'?{x:HARBOR.gate.x,y:HARBOR.gate.y-50}:id==='trade'?{x:SLOTS[9].x,y:SLOTS[9].y+20}:{x:786,y:460};camera.x=center.x;camera.y=center.y;zoom=1.75;clampCamera();updateSceneUI();
 soundMixer.play('victory');celebration={id,moment:custom,time:0,savedCamera,center};particles=[];document.body.classList.add('moment-playing');
 const overlay=document.createElement('section');overlay.id='momentOverlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',m.title);
 overlay.innerHTML='<header class="moment-title"><small>'+m.eyebrow+'</small><h2>'+m.title+'</h2></header><article class="moment-letter"><div class="moment-letter-top">'+momentSeal(m.id)+'<p id="momentChapter">'+m.chapters[0]+'</p></div><blockquote>'+m.quote+'</blockquote><div class="moment-prize">留下的纪念 · '+m.reward+'</div><div class="moment-time"><i id="momentTime"></i></div><footer><button class="moment-later" id="momentLater">稍后再看</button><button id="momentClaim">跳过演出并收下纪念</button></footer></article>';
 document.body.append(overlay);$('app').inert=true;$('momentLater').onclick=()=>endMoment(false);$('momentClaim').onclick=()=>endMoment(true);$('momentClaim').focus();
 overlay.onkeydown=e=>{if(e.key==='Tab'){const buttons=[...overlay.querySelectorAll('button')];const i=buttons.indexOf(document.activeElement);e.preventDefault();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus()}};
 persist();
}
function updateMoment(dt){
 const e=celebration;if(!e)return;e.time+=dt;const m=e.moment||MOMENTS.find(x=>x.id===e.id);
 const chapter=m.chapters[Math.min(2,Math.floor(e.time/3))];if($('momentChapter').textContent!==chapter)$('momentChapter').textContent=chapter;
 $('momentTime').style.width=Math.min(100,e.time/9*100)+'%';
 if(e.time>=9)$('momentClaim').textContent='收下这份纪念 →';
}
async function endMoment(claim){
 const e=celebration;if(!e||e.claiming)return;let reward=null;if(claim){e.claiming=true;const button=$('momentClaim');if(button){button.disabled=true;button.textContent='正在收下纪念…';}try{const r=await serverPersonal.command(e.moment?'specialization':'moment',{day:state.day,...e.moment?{path:e.moment.path,rank:e.moment.rank}:{momentId:e.id}});reward=r.receipt.details;}catch(error){e.claiming=false;if(button?.isConnected){button.disabled=false;button.textContent='核对后收下纪念 →';}toast(error.message);return;}}celebration=null;$('momentOverlay')?.remove();$('app').inert=false;document.body.classList.remove('moment-playing');
 camera.x=e.savedCamera.x;camera.y=e.savedCamera.y;zoom=e.savedCamera.zoom;clampCamera();updateSceneUI();renderUI();persist();
 if(reward)toast('已铭记 · '+reward.title+'。纪念装饰已留在岛上。');
 $('journalOpen')?.focus();
}
storiesUI=createResidentStoriesUI({state:()=>state,profile,portrait:halfPortrait,itemArt:id=>itemMarkup(id,theme,'item-art'),openModal,persist,back:talk});
fishingUI=createFishingPartyUI({command:(operation,args={})=>serverCommerce.command(operation,{day:state.day,...args}),play:serverFishing,stories:id=>storiesUI.open(id),state:()=>state,theme:()=>theme,profile:i=>i===-1?state.playerProfile:profile(i),portrait:halfPortrait,openModal,closeModal,persist,toast,projects:()=>projectUI.open(),detail:id=>contentUI.detail(id),back:showParty,collections:()=>collectionsUI.open(),canDisplay:canDisplayWonder,planParty:async(input,expected)=>{const s=state,t=theme;persist();await saves.flush(t);if(state.saveSlot!==s.saveSlot||theme!==t)throw Error('小岛已经更换');const r=await fetch('/api/parties/'+t+'/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),worldKey:s.saveSlot,input,...expected}),signal:AbortSignal.timeout(60000)});const data=await r.json();if(!r.ok)throw Error(data.error||'主题建议暂不可用');return data;},walkToVenue:()=>{closeModal();if(scene!=='world')setScene('world');planMove(fishingSpots()[2],()=>{persist();checkFishingArrival();fishingUI.open()});if(actor.path.length){const target=fishingSpots()[2],end=actor.path.at(-1);if(Array.from({length:9},(_,i)=>worldWalkable(end.x+(target.x-end.x)*i/8,end.y+(target.y-end.y)*i/8)).every(Boolean))actor.path.push({...target})};toast('沿栈桥走向钓位，等小满和露露收尾工作后到齐。')},onFinish:r=>{log('海风钓鱼大会完成，获得 '+r.reward+' 岛币，贝壳奖杯记入收藏。'+(r.newWonders?.includes('cooperation_monument')?'真实协作获得同心启航纪念碑。':'')+'');fishingRuntime.release()}});
recruitmentUI=createRecruitmentUI({state:()=>state,theme:()=>theme,saves,persist,openModal,toast,back:showHermes,projects:()=>projectUI.open(),command:(...args)=>serverCommerce.command(...args),refreshActor:()=>{runtime.syncProjects();recruitmentRuntime.reset()}});recruitmentUI.reset();
hydrateJourney(state);
serverFacility=createServerFacility({saves,theme:()=>theme,persist,toast,applyState:next=>{state=next;renderUI()},onRecovered:r=>{placementUI.cancel(false);if(['place','move','store'].includes(r.ticket.command))placementUI.inventory();else functionalUI.open(r.details.id);}});
functionalUI=createFunctionalUI({command:(operation,args)=>serverFacility.command(operation,{day:state.day,...args}),state:()=>state,theme:()=>theme,openModal,persist,toast,event:message=>log(message,false),book:()=>placementUI.inventory(),hooks:()=>({releasePlot:(i,owner)=>{runtime.releaseFarm(i,owner);serverFarm.cancelWater(i,owner)},claimPlot:runtime.claimFarm})});
placementUI=createPlacementUI({command:(operation,args)=>serverFacility.command(operation,{day:state.day,...args}),state:()=>state,theme:()=>theme,openModal,closeModal,persist,toast,event:message=>log(message),functional:id=>functionalUI.open(id),bag:()=>contentUI.bag(),goWorld:()=>{if(scene!=='world')setScene('world');},actors:()=>[...(scene==='world'?[actor]:[]),...npcs.filter(n=>n.inside==null&&n.visible!==false),...(visitors?.guests||[]).filter(g=>g.visible&&g.inside==null)]});
collectionsUI=createCollectionsUI({state:()=>state,theme:()=>theme,openModal,persist,toast,canDisplay:canDisplayWonder,recipes:()=>contentUI.recipes('all')});
specializationUI=createSpecializationUI({deliver:commissionId=>serverCommerce.command('career',{day:state.day,commissionId}),state:()=>state,theme:()=>theme,openModal,persist,renderUI,toast,detail:id=>contentUI.detail(id),farm:()=>journeyAction('farm'),party:showParty,back:()=>journeyUI.open(),celebrate:beginMoment});
coCreationUI=createCoCreationUI({theme:()=>theme,state:()=>state,openModal,closeModal,back:showAdmin,detail:id=>contentUI.detail(id),toast});
partyHosting=createPartyHostingRuntime({state:()=>state,theme:()=>theme,actions:()=>saves.status(theme).actions,allowed:()=>scene==='world'&&!document.hidden&&!modal&&!celebration&&!changingTheme&&!window.hdLanOverlayOpen&&!actor.action&&!actor.path.length&&!saves.blocked(theme)&&!saves.pendingAction(theme)&&serverCommerce.ready()&&!Object.values({serverCraft,serverParty,serverFishing,serverFestival,serverCouture,serverFireworks}).some(c=>c?.busy()),command:(op,args)=>serverCommerce.command(op,{day:state.day,...args}),start:startHostedParty,event:m=>log(m,false),toast});
partyGuideUI=createPartyGuideUI({hosting:partyHosting,toast,state:()=>state,theme:()=>theme,profile,openModal,
 openTemplate:t=>({night:nightUI,fishing:fishingUI,market:festivalUI,couture:coutureUI,fireworks:fireworksUI})[t]?.open(),
 invite:(t,id)=>({night:nightUI,fishing:fishingUI,market:festivalUI,couture:coutureUI,fireworks:fireworksUI})[t]?.invite(id),
 projects:()=>projectUI.open(),detail:id=>contentUI.detail(id),stories:id=>storiesUI.open(id),collections:()=>collectionsUI.open(),
 legacy:()=>{const d=state.nightParty?.draft,invited=!!state.partyInvites?.[0]&&!!state.partyInvites?.[2],relationship=[0,2].map(id=>({id,...relationshipInvitation(state,id,[0,2])})).find(r=>!r.ready);return{ready:d?nightReadiness(state).ready:invited&&canHostParty(state),relationship,fireworksAvailable:availableQuantity(state,'firework')>=1,start:startLanternGame};}
});
journeyUI=createJourneyUI({cocreation:()=>coCreationUI.open(),specializations:()=>specializationUI.open(),state:()=>state,openModal,action:journeyAction,celebrate:beginMoment,collections:()=>collectionsUI.open()});
runManagementUI=createRunManagementUI({openModal,back:showAdmin,projects:()=>projectUI.open(),toast,onPolicyChange:policy=>{if(!policy.paused)runtime.recheckAutomatic()}});
npcAuditUI=createNpcProfileAuditUI({state:()=>state,openModal,edit:editNpc,back:showAdmin});
workbenchUI=createWorkbenchUI({theme:()=>theme,openModal,back:showHermes,toast});
stewardChat=createStewardChat({workbench:()=>workbenchUI.open(),previewArtifact:id=>workbenchUI.preview(id),state:()=>state,profile:()=>profile(15),portrait:()=>residentStage(15),openModal,persist,request:(message,retry,history,options)=>runtime.steward(message,retry,history,options),edit:()=>editNpc(15),appearance:()=>contentUI.wardrobe(true),guide:()=>journeyUI.open(),health:()=>runtime?.health||{hermes:'准备交流'},recruit:()=>recruitmentUI.open(),party:template=>template==='fireworks'?fireworksUI.open():template==='couture'?coutureUI.open():template==='night'?nightUI.open():template==='market'?festivalUI.open():template==='fishing'?fishingUI.open():showParty(),projects:()=>projectUI.open(),manageTask:(id,action)=>runtime.manageTask(id,action)});
renderUI();

// First-day landing pauses simulation until the player closes the welcome card.
function showFirstDay(){
 if(!state.freshStartPending)return;
 const hasKeepsakes=Object.keys(state.eventWonders?.owned||{}).length>0;
 openModal(hasKeepsakes?'第 1 天 · 欢迎回到小岛':'第 1 天 · 从零开始','背包 0 · 岛币 0 · 新的岛屿手账',
  '<section class="journal-opening"><small>CHAPTER 01 / 晨光初至</small><h3>第一份收获，从你亲手开始。</h3><p>'+(hasKeepsakes?'你在联机会客中获得的奇观与经历已经保留。本岛的采集与手作旅程，就从这里开始。':'过去的采集、制作、奇观、经营、任务与交往记录已归零。角色外观和岛名已保留。')+'</p></section><p>先去林地采木材，再去矿洞采矿石，制作第一盏星灯。领取「首盏星灯」纪念后，可获得第一批种子，开始耕种。</p><p class="hint">场景中的公共作业工具可以直接使用；自己的工具可到木作工坊制作。开始前，游戏时间与居民生产保持暂停。</p>',
  '<button class="primary" id="startFirstDay">开始第 1 天 →</button>');
 $('startFirstDay').onclick=()=>{closeModal();toast('新的第一天，从采集与手作开始。')};
 $('startFirstDay').focus();
}
showFirstDay();
async function recoverStartup(){try{for(const controller of [serverGather,serverCraft,serverFarm,serverField,serverFieldNpc,serverResident,serverVisitor,serverCommerce,serverParty,serverFishing,serverFestival,serverCouture,serverFireworks,serverFacility,serverPersonal])await controller.recover();}finally{recoveryBoot=false;bootNotice.remove();$('app').removeAttribute('aria-busy');}}
await activateThemeArtwork(theme);
const startupRecovery=recoverStartup();
$('saveStatus').setAttribute('role','button');$('saveStatus').tabIndex=0;
$('saveStatus').onclick=()=>saveUI.show();
$('saveStatus').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();saveUI.show()}};
paintSaveStatus();
window.addEventListener('storage',event=>{
 if(event.key===activeSlotKey(theme)&&event.newValue&&event.newValue!==state.saveSlot&&!saves.status(theme).dirty)location.reload();
});

if(location.pathname==='/play')window.hdLanBridge={beforeOpen:async()=>{await startupRecovery;await saves.idle(theme);if(modal)throw Error('请先收起当前页面，再打开会客');if(saves.blocked(theme))throw Error('请先核对当前存档，再打开会客');await saves.refresh(theme);await saves.flush(theme);},afterClose:()=>saves.refresh(theme)};
