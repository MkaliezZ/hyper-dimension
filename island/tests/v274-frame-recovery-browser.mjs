// Environmental fault only: no actor, clock, inventory or outcome injection.
process.env.HD_QA_RAF_DROP_AFTER_MS='20000';
process.env.HD_QA_WORK_JOURNAL='1';
process.env.HD_QA_OUT??='qa/v274/native-frame-recovery';
await import('./v213-task-chain-browser.mjs');
