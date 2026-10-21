import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMapTextLayout} from '../src/mapTextLayout.js';

test('resident names and font variants retain their own fractional native text metrics',()=>{
 let calls=0;const cache=createMapTextLayout((text,font)=>{calls++;return text==='黎音 · 你'?(font.startsWith('12px')?53.375:66.71875):41.125;});
 assert.equal(cache.label('黎音 · 你','12px FusionPixel'),53.375);assert.equal(cache.label('小墨','12px FusionPixel'),41.125);
 assert.equal(cache.label('黎音 · 你','15px FusionPixel'),66.71875);
 for(let n=0;n<100;n++)assert.equal(cache.label('黎音 · 你','12px FusionPixel'),53.375);
 assert.equal(calls,3,'unchanged names should not force a native measurement on every map frame');
});
test('font loading invalidation obtains current metrics instead of retaining a fallback-font width',()=>{
 let width=53.375,calls=0;const cache=createMapTextLayout(()=>{calls++;return width;});
 assert.equal(cache.label('黎音','12px FusionPixel'),53.375);width=48.25;assert.equal(cache.label('黎音','12px FusionPixel'),53.375);
 cache.clear();assert.equal(cache.label('黎音','12px FusionPixel'),48.25);assert.equal(calls,2);
});
test('dialogue keeps all original Unicode text with the current font and available width',()=>{
 const width=(text,font)=>Array.from(text).reduce((n,ch)=>n+(/[，。]/u.test(ch)?3:ch==='🌙'?17:font==='wide'?12:10),0),cache=createMapTextLayout(width);
 const text='采矿后去茶屋，等风平再出海。',rows=cache.speech(text,'regular',65);
 assert.deepEqual(rows,['采矿后去茶屋，','等风平再出海。']);assert.equal(rows.join(''),text);assert(rows.every(r=>width(r,'regular')<=65));
 const moon=cache.speech('🌙今晚去看海','regular',40);assert.equal(moon.join(''),'🌙今晚去看海');assert(moon.every(r=>width(r,'regular')<=40));
 assert.notDeepEqual(cache.speech(text,'wide',65),rows);assert.notDeepEqual(cache.speech(text,'regular',40),rows);
 assert.throws(()=>rows.push('other resident text'),TypeError,'one dialogue cannot mutate the next resident cached rows');
});
test('changing residents and dialogue cannot grow the label or speech caches beyond their bounds',()=>{
 let calls=0;const cache=createMapTextLayout(text=>{calls++;return text.length*8;},{labelLimit:2,speechLimit:1});
 cache.label('一','font');cache.label('二','font');cache.label('一','font');cache.label('三','font');const before=calls;cache.label('二','font');assert.equal(calls,before+1);
 for(let n=0;n<100;n++){cache.label('来宾'+n,'font');cache.speech('对话'+n,'font',40);}
 assert.equal(cache.inspect().labels,2);assert.equal(cache.inspect().dialogue,1);cache.clear();assert.equal(cache.inspect().labels,0);assert.equal(cache.inspect().dialogue,0);
});
