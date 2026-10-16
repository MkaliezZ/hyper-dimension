# LAN identity publication on Windows

The Windows gameplay job for commit `16b6f56` passed both V211 recovery-return cases. It then failed in the origami visiting-party case: `room_create` returned HTTP 503 with `code: EPERM`, so the invitation code never appeared. The retained report does not identify the filesystem syscall or path; it does not prove the user encountered the same error.

The identity store used a separate single-attempt temporary-file rename, bypassing the existing Windows publication handling. Replacing either the current identity or its previous snapshot with an injected, one-off Windows `EPERM` reproduces a rejected room creation. The new integration regression fails against the previous implementation.

The store now uses the existing `atomicJSON` publisher. It writes and syncs an exclusive temporary file, retains the committed destination, and retries only Windows `EPERM`, `EACCES`, or `EBUSY` replacement failures with the existing bounded schedule. It never deletes the destination, skips ownership, or retries the entire room command. Permanent permission failures and unrelated disk errors still propagate; temporary files are cleaned up. JSON formatting changes, but document schema, checksums, request IDs and account permissions do not.

The regression exercises actual identity documents and room actions: transient contention at either publication, one durable room and receipt after reopen/replay, bounded permanent denial, immediate disk-error propagation, preserved committed state, and successful explicit retry after the fault clears. Existing atomic-publication and exclusive-lock boundary checks remain. The native visiting-party diagnostic now retains the failed API message as well as its status and code.

These are isolated automated checks with fictional accounts. They do not establish physical multi-device or human acceptance. README text is unchanged because this is a reliability correction.
