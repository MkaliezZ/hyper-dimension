# V339 · Autosave identity-writer recovery

An explicit HTTP 503 / `lan_busy` response now follows the existing bounded retry path for a durable autosave. The identity guard rejects this request before invoking the home-island write. Retries retain the exact saved body: save ID, expected version, client ID, state and active seconds. The maximum remains three attempts with the original 250/750 ms backoff and existing request deadlines.

This prevents a temporary identity writer from prematurely rejecting the save awaited by a manually created preparation project. Project commands still wait for the acknowledged save. Persistent contention retains the original autosave journal; unknown transport errors, generic storage failures, authentication rejection and version conflicts keep their existing recovery rules. No user data, travel guard, balance, authority rule or test deadline is changed.

## Evidence and remaining boundary

- The new ten-case regression covers both styles, temporary replies before and after a commit, exact save identity and active-time preservation, persistent failure and explicit non-retry boundaries. Six relevant cases fail on the prior source and pass with this repair.
- The existing fourteen command retry cases remain unchanged. The exact default command passed all 1,783 cases (1,769 + 14), with no failed, skipped or cancelled cases. Payload bytes were checked before and after.
- Both native themes passed the busy-before/busy-after-commit scenario, then completed physical prerequisite and final crafting, result claim, narrow layout and reload under the original 30-second preparation and 180-second work deadlines.
- The original native custom-agent scenario is unchanged by default. Its opt-in `HD_QA_CUSTOM_AUTOSAVE_BUSY=1` mode injects a busy reply before a save and another after an actual commit, checks byte-identical replay/version, then requires the original physical prerequisite work, result claim, narrow layout and reload checks.
- The failing hosted Windows run and its isolated artifacts remain recorded. Local native evidence is automated; hosted recovery is not confirmed until the successor Windows content job passes. Full four-map native, physical multi-device, real-player and OPC acceptance remain open.
