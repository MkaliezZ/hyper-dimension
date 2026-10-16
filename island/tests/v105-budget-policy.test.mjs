import test from 'node:test';import assert from 'node:assert/strict';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {ECONOMY_POLICY_VERSION,hydrateEconomy,townDailyBudget,tickTownEconomy,transact} from '../src/economy.js';
const transform=(x=1,y=x)=>({a:x,b:0,c:0,d:y}),fresh=()=>hydrateTown(createState());
test('an old V32 day keeps its full bill and already settled history, then transitions once at the next day',()=>{
 const s=fresh();Object.assign(s.economy,{budgetPolicyVersion:32,budgetPolicyStartsDay:1,daySeconds:100,townDays:[{day:0,budget:80,paid:80,net:-8}]});s.coins=300;
 hydrateEconomy(s);assert.equal(s.economy.budgetPolicyVersion,ECONOMY_POLICY_VERSION);assert.equal(s.economy.budgetPreviousVersion,32);assert.equal(townDailyBudget(s).total,80);
 let restored=hydrateTown(JSON.parse(JSON.stringify(s)));assert.equal(townDailyBudget(restored).total,80);assert.deepEqual(restored.economy.townDays,s.economy.townDays);
 tickTownEconomy(restored,800);assert.equal(restored.day,2);assert.equal(restored.coins,220);assert.equal(townDailyBudget(restored).total,72);
 restored=hydrateTown(JSON.parse(JSON.stringify(restored)));assert.equal(restored.economy.budgetPolicyStartsDay,2);tickTownEconomy(restored,900);assert.equal(restored.coins,148);assert.equal(restored.economy.townDays.at(-1).policyVersion,ECONOMY_POLICY_VERSION);
});
test('pending older migrations preserve the active policy rather than the advertised future version',()=>{
 for(const [version,previous,expected] of [[32,26,80],[32,12,18],[26,12,18]]){
 const s=fresh();Object.assign(s.economy,{budgetPolicyVersion:version,budgetPreviousVersion:previous,budgetPolicyStartsDay:2,daySeconds:200});
 hydrateEconomy(s);assert.equal(s.economy.budgetPreviousVersion,previous);assert.equal(townDailyBudget(s).total,expected);
 }
});
test('fresh upkeep is fixed by facilities; manual income does not raise the bill or accrue debt',()=>{
 const s=fresh(),before=townDailyBudget(s);assert.equal(before.total,72);assert.equal(before.policyVersion,ECONOMY_POLICY_VERSION);
 transact(s,{income:100,category:'order'});assert.deepEqual(townDailyBudget(s),before);
 s.economy.daySeconds=0;const again=hydrateTown(JSON.parse(JSON.stringify(s)));assert.equal(again.economy.budgetPolicyStartsDay,1);assert.equal(townDailyBudget(again).total,72);
});

test('an open V105 day keeps its 84-coin bill through reload and changes only the following day',()=>{
 const s=fresh();s.coins=400;Object.assign(s.economy,{budgetPolicyVersion:105,budgetPolicyStartsDay:1,daySeconds:300,townDays:[{day:0,budget:84,paid:84,policyVersion:105}]});
 hydrateEconomy(s);assert.equal(townDailyBudget(s).total,84);assert.equal(s.economy.budgetPreviousVersion,105);
 const restored=hydrateTown(JSON.parse(JSON.stringify(s)));assert.equal(townDailyBudget(restored).total,84);assert.deepEqual(restored.economy.townDays,s.economy.townDays);
 const [oldDay]=tickTownEconomy(restored,600);assert.equal(oldDay.budget,84);assert.equal(oldDay.policyVersion,105);assert.equal(restored.coins,316);
 assert.equal(townDailyBudget(restored).total,72);const [newDay]=tickTownEconomy(restored,900);assert.equal(newDay.budget,72);assert.equal(newDay.policyVersion,ECONOMY_POLICY_VERSION);assert.equal(restored.coins,244);
 const [third]=tickTownEconomy(hydrateTown(JSON.parse(JSON.stringify(restored))),900);assert.equal(third.budget,72);
});
