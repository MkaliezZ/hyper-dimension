# Queued work, world identity and fixed shifts

## Before a manual request starts

A deliberately pre-created raw test save lacked its normal island identity. Ordinary new islands use the tenant bootstrap, which assigns that identity; the initial probe had bypassed it. The manual service rejected the malformed save only after writing a `running` request, leaving a request that had never reached the provider.

The service now validates the saved world identity before consuming a request ID or recording a running job. Both themes verify that the malformed document stays unchanged, no provider command starts, and the same request can be used once after an explicit restart of that disposable fixture. Existing durable replay and owner isolation remain. This does not reset, repair or delete a user's save automatically.

## Working hours are part of the queue

Queued resident work respects the existing fixed shifts, sleep and essential needs. The steward's cleaned observation now includes the resident's work hours and current period. The prompt distinguishes queuing from immediate execution. Task cards explain off-shift, sleeping and essential-needs waits without editing the protected task book.

When a work shift begins, pending tasks can take over optional, unleased leisure travel. A granted action, outstanding receipt, conversation, essential rest or active story is preserved. Restored and resumed tasks are reattached to their actor. The shift itself and automatic model cadence do not change.

## Evidence and retained boundaries

Two real manual Hermes sessions on DeepSeek Flash generated the requested forest → shore → forest dependency chains. Pixel completed the original sequence. Origami was correctly off shift; its original task IDs were resumed when the same world clock naturally reached the next work shift, then survived another refresh and fresh browser. The clock stayed at rate 1 and a 900-second visual day. No additional provider request was made during that resumption. The original probe also admitted one automatic steward round per owner, so it is recorded as a mixed-life run rather than an isolated two-call benchmark. [Sanitized evidence](verification/v214/real-queued-work.json).

The V213 Windows screenshot likewise showed the final job waiting after 18:00. The native gate now budgets 120 working seconds for each job, retaining the original first-job allowance and the combined 240 seconds for the two remaining jobs. Off-shift calendar waiting is separate and bounded by two visual days; the fixture clock must remain unchanged. The full native queue test has its own three-platform job with the same 45-minute cap, so its calendar wait does not consume receipt-test time. All existing commands, platforms and final quantity/replay assertions remain.

These checks use fictional accounts and a needs fixture. They do not establish a complete zero-start economy, all task types, full primary/sub-Agent orchestration, physical devices, human play or the original 18 requirements. Hosted results remain separate from local evidence.
