# V338 · Visitor arrival receipt recovery

Joining an island now reuses its durable request ID when the identity writer is temporarily busy, a network response is lost, the response body is truncated, or the existing request deadline expires. The existing maximum of three attempts, 300/800 ms backoff and 12-second per-request deadline remain.

No new request ID or alternate invitation is generated. Server replay still checks the account and complete request fingerprint. Invalid invitations, full rooms, expired identity and conflicting request content remain explicit errors. Host creation and chat retain their existing explicit recovery policy. Exhausted transport failures retain the pending command for the existing recovery button.

## Evidence and limits

- The new four-case default regression covers identical envelopes, bounded failure, business/identity rejection and actual HTTP recovery.
- A fictional HTTP session receives one busy response, loses the body of a committed arrival reply, then obtains the same request receipt. The journal contains one receipt and one arrival event, and the room contains one copy of the guest.
- The existing four movement/departure retry cases remain unchanged.
- The exact default command passed all 1,773 cases (1,759 + 14), with no skipped or cancelled cases. Payload bytes were checked before and after the run.
- This targeted transport repair does not establish the complete four-map native A2A/paid-activity flow, real players, physical multi-device use, or OPC validation. The private graphics performance candidates remain unpublished.
