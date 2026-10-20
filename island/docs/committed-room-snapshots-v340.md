# V340 · Responsive committed room snapshots

A2A, activity and social room checks now read the last complete checksummed atomic identity commit without competing with a home-island writer. Returned snapshots are detached. Outdated geography still uses the original exclusive writer, backup and migration path. Missing rooms and corrupt documents keep explicit failure responses.

All identity mutations, movement, departure, travel exclusion, request replay and the five-second lock deadline remain unchanged. This avoids a room-read `lan_busy` failure during concurrent map polling without allowing production to run while its owner is away or replaying a rejected command later.

## Verification and remaining work

- Eight new controls cover both styles, concurrent snapshots during a held home transaction, detached results, later room closure, corrupt bytes, legacy migration and real HTTP collaboration polling. Three of the six initial controls fail on the previous source; both additional HTTP cases time out there. All eight pass with this repair. Existing travel/home authorization controls also pass. The exact default command passed all 1,791 cases (1,777 + 14), with no failures, skips or cancellations; payload hashes were verified before and after.
- The private four-map scenario completed the full origami workflow, and all three real Hermes/A2A funded preparations in pixel mode. Pixel later hit the unchanged 30-second navigation deadline after a simulated post-commit reply loss. Its source, failure and owned-worker diagnostic evidence remain retained.
- This commit contains only the room-read repair. The separate artwork worker/terrain candidate remains unpublished and its refresh blocker remains open. Full dual-style four-map qualification, hosted results, final package/video, natural long play, physical devices, human players and OPC acceptance remain separate delivery requirements.
