# Acknowledged progress publication

The Windows sequential-work artifact completed its first job, then stopped in a save conflict after reload. The Intel Mac shelf artifact recorded a real visitor purchase, then the same conflict blocked the management button after reload. Neither artifact reported a failed HTTP save. These observations identify recovery failures; they do not by themselves prove one root cause.

A separate deterministic regression found that an accepted action or protected autosave exposed its new resources to the UI before recording the acknowledged server version and retiring the outgoing request. A pagehide at that boundary could persist the new resources with the old baseline. The four theme/operation cases failed before the change.

Accepted results now commit independent local edits against the acknowledged baseline in the same transaction that retires the outgoing request, recheck any edits made while IDB cleanup yields, then publish the server baseline, merged state and version in one synchronous step. An unload during cleanup keeps the exact idempotent request beside its outgoing emergency snapshot for startup recovery. If a later merge or storage cleanup fails, the exact original request is retained for explicit recovery. Independent edits survive; overlapping edits and different island identities still require reconciliation. No local receipt, reward, clock increment or automatic choice of conflicting resources is introduced.

Original native task and tourist assertions, request deadlines and budgets remain unchanged. Hosted recovery stays unconfirmed until the successor jobs pass. See [verification](verification-v346.json).

The final runtime source passed 1,862 default cases (1,848 + 14), without failures, skips or cancellations, and the original native sequential-task and custom-shelf commands passed both themes (four cases). All original native test files, budgets and runtime source hashes were checked before and after. This is isolated automation, not human or physical multi-device acceptance; hosted recovery remains pending.
