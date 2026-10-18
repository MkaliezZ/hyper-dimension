# V278 — Ferry arrival clock ordering

A visitor arrival used to skip its checkpoint when a resident result was already in flight. The arrival could then reach the authoritative server before the visible play time was saved, receive `visitor_early`, and display an unnecessary recovery card. Arrival now always waits in the existing save-command queue and checks the acknowledged visitor clock before submission. Uncertain journals still block; early arrivals, payment, stock and service-time validation retain their original authority.

The original adapter fails the first controlled pending-resident case. The corrected actual DOM adapter passes six cases: both styles with an in-flight resident receipt, an unresolved journal, a genuinely early local arrival, an ordinary arrival, and an unrelated begin operation. These cases use a protocol spy, not a running island authority.

Forty related rules and the default command (1,424 main cases plus 14 Windows writer guards) pass without failures or skips.

The separate actual production-to-sale run passes both styles with the original 150-second road/service budget, 75/650 ms slow-frame policy and accepted other-domain replies delayed by two seconds. Road/service takes 35.542 and 35.385 seconds. A resident makes the prerequisite and final gift, the stocked item changes from one to zero, and the authority records seven income and three cost. Reload retains the shelf. No arrival request or other save request is rejected. Wood/resin/fiber 50 and needs are declared fixtures; normal clocks and blocked providers remain. This is not zero-start, human, physical multi-device or Mac acceptance.

## Open macOS failures

The baseline hosted run retains three failures: Intel painting brush equipment, ARM pearl-cup refresh readiness, and ARM sequential resident work. Owned Windows native painting and pearl-cup flows pass both styles with unchanged fixtures, input, five-second equipment gate, refresh timeouts and financial assertions. This does not establish a macOS repair.

Painting and pearl-cup diagnostics now retain phases, save-request metadata, frame/save observations and owned-process samples. The previously omitted pearl-cup report, progress and failure screenshots are included in the workflow artifact paths. Save bodies, authorization, model prompts and private documents are excluded from request metadata.

The verified ARM resident artifact shows stopped page observations while owned browser processes remain alive with low CPU. This is evidence for further investigation, not proof of an out-of-memory, GPU, application-deadlock or timer cause. If an owned macOS page observation remains pending for 15 seconds, diagnostics sample at most two renderers and one GPU process from that browser's CDP-owned process list, with bounded commands. Triggering sampling explicitly invalidates acceptance even if the fixture later resumes; a profiler intervention cannot turn this unresolved failure green. Actual macOS stack collection is pending.

See [scoped evidence](verification/v278/visitor-clock.json). The final current-source hour, final delivery, OPC course, actual new-player acceptance and remaining requirements stay open.
