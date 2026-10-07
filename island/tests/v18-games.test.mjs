import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLevel,seededRandom,pieceOffsets,mazePath,chooseDifficulty,createGameContext} from '../src/gameLevels.js';
import {ITEM_BY_ID} from '../src/contentCatalog.js';
import {linkPath,makeLinkBoard,solveLinks,shuffleLinks,matchMoves,matchGroups,createMatchState,swapMatch,matchWon,shuffleMatch,matchSnapshot,suggestMatchMove} from '../src/classicRules.js';

test('25 buildings vary actual gameplay data, reproduce a seed, and use real item art',()=>{
 for(let id=0;id<25;id++)for(let difficulty=1;difficulty<=3;difficulty++){
  const levels=Array.from({length:8},(_,k)=>makeLevel(id,{seed:k+112,difficulty}));
  assert.deepEqual(levels[0],makeLevel(id,{seed:112,difficulty}));
  const signatures=levels.map(({seed,variant,...l})=>JSON.stringify(l));assert.ok(new Set(signatures).size>=3,'gameplay variation '+id);
  for(const l of levels)for(const key of [...(l.items||[]),...(l.link?.ids||[]),...(l.memory?.ids||[]),...(l.arrangement?.choices||[]),...(l.photos||[]).map(x=>x.art),...(l.puzzle?[l.puzzle.referenceItem]:[])])assert.ok(ITEM_BY_ID[key],'catalog art '+key);
 }
});
test('random packing silhouettes have complete nonoverlapping solutions in every difficulty',()=>{
 for(let seed=1;seed<=75;seed++)for(let difficulty=1;difficulty<=3;difficulty++){
  const l=makeLevel(0,{seed,difficulty}),used=new Set();
  for(const move of l.solution){assert.ok(l.target.includes(move.index),'clickable placement anchor');
   const cells=pieceOffsets(l.pieces[move.piece],move.rotation).map(([dx,dy])=>{
    const x=move.index%6+dx,y=Math.floor(move.index/6)+dy;assert.ok(x>=0&&y>=0&&x<6&&y<4);return y*6+x;
   });
   assert.deepEqual(cells,move.cells);for(const cell of cells){assert.equal(used.has(cell),false);used.add(cell);}
  }
  assert.deepEqual([...used].sort((a,b)=>a-b),[...l.target].sort((a,b)=>a-b));assert.equal(l.pieces.length,2+difficulty);
 }
});
test('generated mazes keep all supplies and the exit reachable within their step budgets',()=>{
 for(let seed=1;seed<=35;seed++)for(const difficulty of [1,2,3]){
  const m=makeLevel(22,{seed,difficulty}).maze;
  for(const target of [...m.targets,m.exit])assert.ok(mazePath(m.start,target,m.walls).length);
  assert.ok(!m.steps||m.steps>=m.optimal);assert.ok(m.targets.every(i=>i!==m.start&&i!==m.exit&&!m.walls.includes(i)));
 }
});
test('link paths allow the border, forbid blocked routes, and stay within two bends',()=>{
 const around=linkPath([0,1,0,2,3,4],3,2,0,2);assert.ok(around);assert.ok(around.length<=4);assert.ok(around.some(p=>p.y===-1));
 assert.equal(linkPath([0,1,2,3,0,4,5,6,7],3,3,0,4),null);assert.equal(linkPath([0,1],2,1,0,1),null);assert.equal(linkPath([0,0],2,1,0,0),null);
 for(let seed=1;seed<=30;seed++)for(let difficulty=1;difficulty<=3;difficulty++){
  const l=makeLevel(11,{seed,difficulty}),{columns,rows}=l.link,board=makeLinkBoard(l),solved=solveLinks(board.values,columns,rows);
  assert.equal(solved.length,columns*rows/2);assert.ok(solved.every(x=>x.path.length<=4));
  const partial=[...board.values];for(const m of solved.slice(0,3))partial[m.a]=partial[m.b]=null;
  const shuffled=shuffleLinks(partial,columns,rows,seededRandom(seed+17));assert.ok(shuffled.solution);
  assert.deepEqual(shuffled.values.filter(x=>x!=null).sort(),partial.filter(x=>x!=null).sort());
 }
});
test('match games start without free matches, have legal moves, and invalid swaps cost nothing',()=>{
 for(let seed=1;seed<=40;seed++){
  const s=createMatchState(makeLevel(3,{seed,difficulty:2}));assert.equal(matchGroups(s.values).length,0);assert.ok(matchMoves(s).length);
  const legal=new Set(matchMoves(s).map(([a,b])=>a+','+b));
  let invalid;for(let a=0;a<36&&!invalid;a++)if(a%6<5&&!legal.has(a+','+(a+1)))invalid=[a,a+1];
  if(invalid){const before=matchSnapshot(s);assert.equal(swapMatch(s,...invalid).valid,false);assert.deepEqual(matchSnapshot(s),before);}
  const before=s.moves;assert.equal(swapMatch(s,...suggestMatchMove(s)).valid,true);assert.equal(s.moves,before-1);assert.ok(s.score>0);assert.equal(matchGroups(s.values).length,0);
 }
});
test('four and five in a row create powers; powers and cascades advance real goals',()=>{
 for(const n of [4,5]){
  const s=createMatchState(makeLevel(3,{seed:188,difficulty:1}));
  s.values=Array.from({length:36},(_,i)=>(i%6+Math.floor(i/6)*2)%5);s.specials.fill(null);
  for(let i=0;i<n;i++)s.values[12+i]=4;
  s.values[12]=2;s.values[6]=4;
  const r=swapMatch(s,6,12);assert.ok(r.valid);
  assert.ok(r.frames.some(f=>f.kind==='clear'&&f.created.some(([,p])=>p===(n===5?'rainbow':'row'))),'created power '+n);
 }
 const s=createMatchState(makeLevel(9,{seed:21,difficulty:2}));s.specials[7]='row';s.specials[8]='column';
 const r=swapMatch(s,7,8);const clear=r.frames.find(f=>f.kind==='clear');assert.ok(clear.cleared.length>=11);assert.ok(clear.activated.length>=2);
 const rainbow=createMatchState(makeLevel(9,{seed:21,difficulty:2}));rainbow.specials[7]=rainbow.specials[8]='rainbow';
 const clearAll=swapMatch(rainbow,7,8);assert.equal(clearAll.frames.find(f=>f.kind==='clear').cleared.length,36);assert.equal(rainbow.sealsCleared,rainbow.sealGoal);
});
test('reshuffling is limited, does not grant items/score/goals, and prevents stuck boards',()=>{
 const s=createMatchState(makeLevel(9,{seed:7,difficulty:3})),before=matchSnapshot(s);
 assert.equal(shuffleMatch(s,true),true);assert.equal(s.shuffles,0);assert.equal(shuffleMatch(s,true),false);
 assert.equal(s.moves,before.moves);assert.equal(s.score,0);assert.deepEqual(s.targets,before.targets);assert.deepEqual(s.seals,before.seals);assert.ok(matchMoves(s).length);
});
test('objective-aware play can complete a broad seeded sample without reshuffle farming',()=>{
 for(const difficulty of [1,2,3]){
  let wins=0;for(let seed=1;seed<=40;seed++){
   const s=createMatchState(makeLevel(3,{seed,difficulty}));
   while(s.moves&&!matchWon(s)){const move=suggestMatchMove(s);assert.ok(move);swapMatch(s,...move);}
   if(matchWon(s))wins++;
  }
  assert.ok(wins>=30,'at least 75% of seeded boards, difficulty '+difficulty+': '+wins);
 }
});
test('difficulty adapts gently, remembers manual choices and persists outcomes once without economic rewards',()=>{
 assert.equal(chooseDifficulty({wins:0,attempts:0},'auto',()=>.99),1);
 assert.equal(chooseDifficulty({wins:20,lossStreak:1},'auto',()=>.99),2);
 assert.equal(chooseDifficulty({wins:0,attempts:10},'3'),3);
 const state={inventory:{wood:30},coins:100,roomGames:{}};
 let saves=0;const a=createGameContext(state,7,{persist:()=>saves++},'2');a.onOutcome({passed:true,quality:92});a.onOutcome({passed:true,quality:92});
 assert.equal(state.miniGameHistory[7].wins,1);assert.equal(state.miniGameHistory[7].attempts,1);
 const restored=JSON.parse(JSON.stringify(state)),b=createGameContext(restored,7,{});assert.equal(b.mode,'2');assert.notEqual(a.level.seed,b.level.seed);
 b.onOutcome({passed:false});assert.equal(restored.miniGameHistory[7].lossStreak,1);assert.equal(restored.coins,100);assert.deepEqual(restored.inventory,{wood:30});assert.ok(saves>=2);
});
