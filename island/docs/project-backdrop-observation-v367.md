# V367 · Observe application updates under the retained project backdrop

The V365 Intel Mac content job failed the pixel backdrop check because a separate RAF probe advanced only 3 callbacks in 1242.4 ms. The application itself delivered 3 RAF updates plus 6 visible fallback updates; its game clock advanced 1.0281 seconds, the document stayed visible, no canvas clear occurred, and no page error was reported. The original report and job logs are retained.

The test now counts the application loop's RAF plus visible fallback deliveries. The independent raw RAF probe remains a diagnostic. The original strict greater-than-3 update assertion, advancing game clock, unchanged canvas, dimensions, native form input, one canonical plan, disk balance, resize and close checks remain. The 1200 ms observation and all explicit timeouts are unchanged. Production, A2A, deployment and minigame code do not change.

Both appearances pass the normal native flow and an opt-in loss-of-RAF control. In a separate negative control, stopping the actual application loop while leaving the independent RAF probe running fails both appearances at the original progress assertion. Fault controls affect only the owned isolated test browser and are disabled in ordinary CI. No clock, inventory, plan result or receipt is injected by these fault controls. The existing fictional setup still supplies the declared starting wood.

26 related rules pass. See [verification](verification-v367.json) for the four passing native cases and two expected failures; negative controls are not reported as successful native workflows. These are automated local observations, not human or physical Mac acceptance. Hosted recovery remains pending. V362 ZIP and published assets stay sealed.
