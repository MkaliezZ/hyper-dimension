# Queued assignments while other work saves

The Windows native sequential-work artifact showed an autonomous action at the forest completing, followed by a long idle interval while unrelated durable commands occupied the shared queue. The assigned job had not yet obtained its own lease. Decrementing the idle timer alone could not dispatch that job while the pending-save branch continued to own frames.

That branch now also advances existing server-owned assignments. It rechecks the current canonical ready task, shift, needs, activity ownership and manual control. Only that assignment can acquire a destination, finish its approved navigation, enter its work station and request its next lease through the existing serialized action client. A paused, cancelled, reassigned or dependency-blocked task cannot use an old arrival callback. Blocked planning does not fall through to autonomous work. Existing retry backoffs remain.

It grants no resources or receipts locally and starts no autonomous choice or model request. The acknowledged action and its existing authoritative completion remain responsible for work delivery. Legacy local planning continues through the normal update path. Explicit save conflicts still stop play before this branch.

The original first-job 120-second and remaining-chain 240-second working-hour budgets, clock, actors, queue contents and financial assertions remain unchanged. See [verification](verification-v345.json) for the current evidence and pending hosted results.

The final runtime source passed 1,846 default cases (1,832 + 14), without failures, skips or cancellations, and the original native project-form, custom preparation and sequential task commands passed both themes (six cases). All original native test files, budgets and runtime source hashes were checked before and after. This is isolated automation, not human or physical multi-device acceptance; hosted recovery remains pending.
