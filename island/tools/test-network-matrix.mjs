import {resolve} from 'node:path';
process.env.HD_QA_ALL_ACTIVITIES='1';
process.env.HD_QA_REAL_A2A='0';
delete process.env.HD_QA_EVENT_KIND;delete process.env.HD_QA_DIFFICULTY;
process.env.HD_QA_OUT||=resolve('qa/network-activity-matrix');
await import('../tests/v231-multi-island-journey.test.mjs');
