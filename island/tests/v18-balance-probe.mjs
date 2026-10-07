import {makeLevel} from '../src/gameLevels.js';
import {createMatchState,swapMatch,matchWon,suggestMatchMove} from '../src/classicRules.js';
import {ITEM_BY_ID} from '../src/contentCatalog.js';
for(let seed=1;seed<=50;seed++)for(let d=1;d<=3;d++)for(let id=0;id<25;id++){
 const l=makeLevel(id,{seed,difficulty:d});
 for(const key of [...(l.items||[]),...(l.link?.ids||[]),...(l.memory?.ids||[]),...(l.arrangement?.choices||[]),...(l.photos||[]).map(x=>x.art),...(l.puzzle?[l.puzzle.referenceItem]:[])])if(!ITEM_BY_ID[key])throw Error('missing art '+key);
}

for(const difficulty of [1,2,3]){
 let wins=0;
 for(let seed=1;seed<=100;seed++){const s=createMatchState(makeLevel(3,{seed,difficulty}));while(s.moves&&!matchWon(s)){const m=suggestMatchMove(s);if(!m)throw Error('deadlock');swapMatch(s,...m)}if(matchWon(s))wins++;}
 console.log('Greedy objective solver difficulty '+difficulty+': '+wins+'/100 wins');
}

