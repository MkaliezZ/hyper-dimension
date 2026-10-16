import {resolve} from 'node:path';
process.env.HD_QA_ZERO_MARKET='1';
process.env.HD_QA_OUT||=resolve('qa/native-zero-market');
await import('../tests/v228-custom-shops-browser.mjs');
