// Immutable historical record captured before V12.
import {readFile} from 'node:fs/promises';
console.log(await readFile(new URL('../qa/v12-economy-before.json',import.meta.url),'utf8'));
