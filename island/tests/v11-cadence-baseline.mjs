// Historical measurement captured before V11. Current runtime must not overwrite it.
import {readFile} from 'node:fs/promises';
console.log(await readFile(new URL('../qa/v11-cadence-before.json',import.meta.url),'utf8'));
