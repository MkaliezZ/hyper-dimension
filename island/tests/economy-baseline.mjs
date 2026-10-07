// Historical pre-V10 capture; current policy must not overwrite it.
import {readFile} from 'node:fs/promises';
console.log(await readFile(new URL('../qa/v10-economy-baseline.json',import.meta.url),'utf8'));
