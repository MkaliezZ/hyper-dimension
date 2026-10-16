# Explicit resident task queues

Manual steward requests can give one resident an ordered sequence instead of replacing their existing work. `island_dispatch.dependsOn` references observed task IDs or the IDs actually returned by earlier dispatch calls in that turn. A resident can retain at most four unfinished standalone jobs; a turn still proposes at most four commands. Automatic patrols keep their previous one-job-per-idle-resident behavior and cadence.

The saved planning transaction checks the latest task book. New work for a busy resident must depend, directly or transitively, on all of that resident's unfinished work. Unknown dependencies, cyclic legacy graphs and paths longer than 64 entries are rejected. Replaying the same command keeps its task; a changed payload cannot replace it. The executor still grants one action lease per actor, waits for actual predecessor completion, and records progress only from confirmed action receipts. Pausing or cancelling a predecessor does not silently complete it or unblock its descendants.

Both the cleaned model observation and the resident runtime retain dependency IDs. The Python tool performs a preflight, then the authoritative server rechecks proposals. Task cards in both themes explain whether they are waiting, blocked by a cancelled predecessor, or waiting for a paused predecessor to resume. Ordinary resource preparation and recruited Agent contracts continue to use their existing plan and population rules.

## Scoped evidence

- Actual saved-state transactions cover both themes, three sequential jobs, restart and receipt replay, rejection of unordered work, queue limits, and pause/cancel protection against late rewards.
- Standard-library Python checks cover manual/automatic boundaries, cleaned dependencies, the actual worker dispatch function, and the registered tool schema. Agent `verify` includes this gate.
- A native isolated LAN check submits a deterministic steward reply through the manual chat UI. One NPC performs forest → shore → forest jobs with real time, movement and tool actions. A mid-chain reload resumes remaining work, and a new browser context recovers all three completed jobs without duplicate receipts. The first browser draft incorrectly counted cards in both chat and sidebar; the selector is now scoped to the task sidebar, with the earlier failure retained in private QA evidence.

The native check uses fictional accounts and a needs fixture, starts with no materials, blocks provider calls, and does not accelerate time. It demonstrates execution of a supplied plan, not a fresh AI decision, human play, a complete zero-start economy, physical devices, or full main/sub-Agent orchestration. The original R01/R02/R03 requirements remain in progress.
