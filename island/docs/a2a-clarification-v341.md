# V341 · Activity clarification and bound steward roles

The host can answer a visiting steward's preparation question. The host's steward forwards that explanation in the same task, and the visiting steward reviews it again. Each task permits up to three explicit host explanations of at most 500 characters. The explanation does not change the activity contract, reset its expiry, accept it for the guest or reserve resources.

The server now binds each model turn to the actual host/guest identities and assigns entry items, fees and preparation checks to the visiting owner. A fully ready check is distinguished from a genuine missing requirement. Acceptance, refusal and clarification remain model decisions; only an explicit guest execute request can reserve goods. Each subsequent reply keeps its parent ledger link.

Preparation facts now distinguish the total requirement, available stock, this event's existing reservation and the remaining net shortage. A requirement of 3, with 2 available and 0 reserved, is reported as 1 still missing. Equipped garments remain in equipment, rather than being counted again in backpack inventory.

## Browser and A2A interface

- The game modal and standard A2A interface expose the same host answer turn. `nextAction` can be `clarify`; SendMessage carries the owner's text and original task ID.
- Pending requests retain their exact ID/body after a lost response. Replays do not launch another model turn or reserve twice.
- Polling preserves the draft, focus and caret. An acknowledged explanation is cleared before the next question. Both themes and the 390-pixel layout use the existing themed card and fixed close control.
- An older backend without the new task capability does not receive an unsupported UI command.

## Evidence and remaining boundary

Five new server/standard-interface cases cover completion after clarification, replay/restart, authorization, immutable terms, round limits and cancellation. Existing collaboration, consent, ownership, protocol and tool-boundary checks remain.

Both themes passed actual native modal tests with deterministic model fixtures, including post-commit response loss, two clarification rounds, protected explicit execution and final receipt. Actual Hermes/DeepSeek Flash role runs also completed for both host styles, with linked messages and a single real protected reservation. The first pixel probe incorrectly expected the equipped outfit in backpack inventory; that failure is retained. The same accepted task and original reservation were resumed to confirmation, with worn equipment verified and no new offer/review or duplicate reservation.

The final exact-source real runs contain nine linked Hermes messages: three for each host style and three for an actual missing-material clarification after a protected refund. The guest correctly states that 3 required and 2 available leave 1 missing; the host answers without changing the terms or reserving absent materials. This is an agent review of those captured replies, not human-player acceptance. The earlier total-versus-shortage error remains retained. The complete default-suite result is recorded in verification-v341.json. The exact default command passed all 1,796 cases (1,782 + 14), without failures, skips or cancellations. Source payloads were verified before and after.

The private artwork candidate, native four-map refresh blocker, fresh final package/video, natural long play, physical devices, real-player and OPC acceptance remain separate requirements.
