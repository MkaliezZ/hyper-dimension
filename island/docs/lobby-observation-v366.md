# V366 · Observe one rendered LAN snapshot

The V365 ARM Mac lobby check compared resident positions from different server
receipts. The renderer had consumed timestamp 1792715112817 while a newer poll
had already published 1792715113322. Waiting two animation frames cannot prevent
another HTTP view from arriving before the subsequent observation. The retained
report and screenshot show the room remained connected, with no page errors.

The native observer now waits until every visible sampled actor has consumed
the view's receipt timestamp, then clones that coherent observation. All 40
samples still execute the original timestamp equality and idle-facing checks.
No sample with a timestamp mismatch is counted. A renderer that does not consume
the view cannot pass. The observation wait is bounded at 30 seconds; all prior
explicit timeouts and the 1500 ms cached-gallery paint budget are unchanged.

Production movement, interpolation, UI, protocol and A2A code are unchanged.
This is a CI observation correction, not a gameplay or minigame change. The
Windows soil-care check from the previous fixes has meanwhile passed hosted CI;
Intel Mac soil recovery and the full matrix remain separate pending results.

See [verification](verification-v366.json). Controlled minimal-browser scheduler
probes are recorded separately from the full native lobby flow. Neither is
human or physical-device acceptance. V362 archives and release assets stay
sealed; this follow-up changes source checks only.
