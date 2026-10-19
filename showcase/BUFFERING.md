# Short-film playback

The public player prepares the selected short film before starting. It shows download progress, verifies the catalog SHA-256, and plays a local Blob URL. Selection changes abort the previous download and release the previous Blob; replay reuses the current prepared film. Files above128MiB are rejected. A browser requiring another sound-enabled gesture retains the ordinary play button.

This follows an observed public-network stall: the original3second gate advanced only0.61seconds despite a valid file and byte-range support. With a declared10Mbps/30ms network fixture, the new player prepared the actual1440p60 V320 film in34.9seconds, passed the unchanged3second advancement/frame gate with180frames and zero dropped frames, and reached the real30second ending. This was an owned Chromium headless-shell process on one Windows machine, not human or physical-device acceptance. Public CDN playback is verified after deployment.

Default Edge showed a separate regular presentation-drop pattern across three encodes with full local buffers. This buffering change does not establish an Edge decoder/presentation repair. The game source package is unchanged by this separate showcase-player update.
