# V364 · Independent soil-care browser contexts

The V363 Windows island job failed in the origami soil-care control while both
appearances were running concurrently in one Chromium process. The click had
already opened the correct compost detail page; Playwright timed out in its
post-input navigation wait. The pixel case subsequently completed. The original
log, screenshot, network timings and failed report remain retained.

The soil controls now run in sequence. The previous context, its owned workers
and isolated server finish cleanup before the next appearance starts. A failed
case is collected and the other appearance still runs. This removes unintended
shared-browser contention from two independent single-island controls. The exact
Chromium stall is not independently established, so this is a CI fixture
isolation change, not a claim that a production rendering defect was repaired.

Every interaction, assertion and timeout inside each case is unchanged. The test
still crafts compost through the native room game, sows, waters, fertilizes,
waits for the full 180-second wheat growth, harvests and reopens the disk save.
There is no injected finished product, skipped interaction, forced click,
disabled NPC work, synthetic time or increased workflow budget. Sequential
execution increases total wall time; the original limits of each case and of
the workflow are unchanged.

No production, A2A, deployment runtime, artwork, recipe or minigame implementation
changes. V362 archives and release attachments remain sealed. See
[the verification record](verification-v364.json); hosted recovery must be
confirmed by the next CI run. Owned automated contexts are not human or physical
device acceptance.

## Local verification

Both native appearance cases passed actual crafting, farming, full real-time
growth, harvest and disk reload. All 37 related soil, farm and lifecycle rules
passed. The recorded cleanup of the pixel context precedes origami startup. All
per-case source bytes, assertions and timeout values match the previous commit.
No production source changed. Hosted recovery remains pending.
