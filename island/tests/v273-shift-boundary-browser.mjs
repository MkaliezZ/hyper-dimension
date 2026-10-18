// Separate opt-in boundary case; the existing full native command stays intact.
process.env.HD_QA_QUEUE_TARGET_HOUR='14';
process.env.HD_QA_WORK_JOURNAL='1';
process.env.HD_QA_OUT??='qa/v273/native-shift-boundary';
await import('./v213-task-chain-browser.mjs');
