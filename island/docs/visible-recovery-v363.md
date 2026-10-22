# V363 · Visible frame liveness and native recovery observation

## Hosted failures retained

Run `39848041014`, source `7275453edebc5583ea91c4a159eb88da09d9a390`, ended with 28 successful jobs, 2 failures and 4 skipped jobs. PostgreSQL integration succeeded separately. The two previously repaired blockers remain successful; these are newly completed failures.

- Intel macOS, native resident work: the origami pending-steward case advanced the normal simulation clock by only 0.9 seconds over its original 3-second observation. NPC travel advanced about 3.26 seconds. The retained backdrop did not repaint, so heavy backdrop rendering was not the failure.
- ARM macOS, native resident work: the origami partial-delivery case durably committed the pause and reused its original request ID. Canonical recovery then navigated to a fresh document. The test read `islandInspect` before that document initialized and failed with ReferenceError; the retained screenshot shows the loading page.

Original logs and downloaded isolation reports are retained locally. No failed run is relabelled as passed.

## Fixes

The visible RAF watchdog previously waited 500ms while simulation advances are capped at 150ms per visible callback. With RAF absent this necessarily lost time. The default watchdog now checks every 50ms and delivers a real timestamp after 100ms without a completed callback. It still owns one RAF chain, cancels late callbacks by generation, excludes hidden time and measures slow callbacks from their completion. **The 150ms economy/save step cap is unchanged.**

The native interruption test now polls for an initialized, ready application before reading recovery state. All existing unlocked/inflight/overlay conditions, resource conservation, receipt uniqueness, partial progress, pause/resume/cancel, restart and owner-takeover assertions remain. No test timeout increased.

The backdrop gate additionally supports an opt-in `HD_QA_LOST_RAF=1` isolation case. It withholds RAF callback delivery only in its owned browser after the actual pending request, then verifies real fallback frames and the same original clock, NPC, resize and close assertions. It does not inject simulation time or stock.

## Validation scope

The new default-watchdog clock regression failed against the old defaults and passed after the fix. Existing explicit-timing frame-loop tests remain unchanged. The normal both-style native backdrop gate has passed locally. The four both-style partial-delivery/restart/takeover cases also passed. The deliberately withheld-RAF control passed both styles with 29/28 real fallback frames and 2.973/3.001 seconds of simulation over the original 3-second window. Detailed results are recorded in `verification-v363.json`.

The first withheld-RAF control exposed a test-observer dependency: its final busy-state wait also polled RAF and therefore timed out while the real clock had advanced 2.989 seconds. That negative report is retained. Only this opt-in observer now polls independently every 100ms; its original 30-second timeout and all busy/reply assertions remain. Normal-mode polling is unchanged.

This is a CI/runtime correction, not minigame development. V362's frozen source archive and published assets are preserved. A2A backend/CLI/protocol sources are not changed. Local browser automation is not physical macOS or human acceptance; hosted recovery must be confirmed by the new commit's CI.

The ordered default Node rule groups pass 2,098 checks, and 52 related clock rules pass. The 2,971-file source payload was verified. This is not a repeat of the full runtime installer, nor a new source ZIP; the frozen V362 package remains available.
