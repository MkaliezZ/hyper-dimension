# Short-film playback

The public player prepares the selected short film before starting. It shows download progress, verifies the catalog SHA-256, and plays a local Blob URL. Selection changes abort the previous download and release the previous Blob; replay reuses the current prepared film. Files above128MiB are rejected. A browser requiring another sound-enabled gesture retains the ordinary play button.

This follows an observed public-network stall: the original3second gate advanced only0.61seconds despite a valid file and byte-range support. With a declared10Mbps/30ms network fixture, the new player prepared the actual1440p60 V320 film in34.9seconds, passed the unchanged3second advancement/frame gate with180frames and zero dropped frames, and reached the real30second ending. This was an owned Chromium headless-shell process on one Windows machine, not human or physical-device acceptance. Public CDN playback is verified after deployment.

Default Edge showed a separate regular presentation-drop pattern across three encodes with full local buffers. This buffering change does not establish an Edge decoder/presentation repair. The game source package is unchanged by this separate showcase-player update.

## Bounded range preparation

A later public observation reached93percent after the original45second preparation deadline. The player now probes one byte, reads the remainder through at most four validated ranges, and verifies the original whole-file SHA-256 before creating its Blob. A server ignoring ranges keeps its one bounded complete response. Invalid ranges, oversized or incomplete bodies, checksum mismatches and selection cancellation reject preparation. The unprepared native video no longer starts a second download.

Seven isolated HTTP boundary checks pass. An owned native Chromium preview with a declared800,000bytes/second limit per connection passed the original45second preparation deadline and unchanged3second frame gate:181frames, zero dropped frames,3.014seconds advancement, and the complete30second ending. No resolution, frame-rate, encoded media or soundtrack changes were made. The readiness selector now reads the selected filename rather than requiring an unprepared network video source. Public CDN playback after deployment remains separately pending; the Edge presentation issue remains open.
