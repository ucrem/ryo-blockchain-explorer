# Node synchronization failure and recovery

## Result

The development node resumed native mainnet synchronization after a controlled,
graceful restart using the existing database and unchanged executable/core pin.
It crossed block 230,110, which had prevented all progress, and the browser again
observed advancing native heights with the node panel showing "Synchronizing".
No chain reset, rewind, validation bypass, core patch or automatic restart loop
was used. The daemon remains running.

## Failure and verified transaction identity

Before recovery, the last stored block was 230,109 (RPC chain height 230,110).
The daemon kept reconnecting and logging:

```text
transaction verification failed on NOTIFY_RESPONSE_GET_OBJECTS
```

Two public mainnet RPC nodes returned identical block bytes and all seven full
transaction blobs for block 230,110. Native parsing and hashing identified the
previously rejected transaction as
`c133f8d2a67df074f683115156fd3eddb4481bef1b68666171932bb46950fce0`.
Its native blob identifier is
`d921a38e147c8d782c1000d1350cc400e045d828dba98fea04471b631651c45c`.
The protocol log's `tx_id` uses `get_blob_hash`, not the consensus transaction
hash. The new public fixture preserves those exact 2,849 bytes; it contains no
peer addresses, pool receipt times or private keys.

The initial failure batch also logged:

```text
Verification failure at step 1
rct signature semantics check failed
```

The first message comes from `rct::bulletproof_VERIFY`
(`src/ringct/bulletproofs.cc:1160`); the second from `core::check_tx_semantic`
(`src/cryptonote_core/cryptonote_core.cpp:816`). These initial messages do not
include their own transaction identifiers. The batch/context is consistent
with the rejected blob, but that alone is not independent hash attribution.

After a semantic rejection, `handle_incoming_tx_post` records the transaction
hash in the in-memory `bad_semantics_txes` cache. `handle_incoming_tx_pre` rejects
later copies immediately from that cache, without rerunning the proof verifier.
This explains the persistent retry loop after the initial rejection.

## Recovery evidence

An isolated process linked to the same native core successfully parsed and
verified all seven transactions. The exact rejected blob passed 300 fresh
semantic checks: 100 sequential and 200 across two concurrent callers, with
zero failures. Generated proofs for 1, 2, 3, 4, 7, 8, 9, 15 and 16 outputs passed;
altered proofs were rejected. The repeat/replay logs stay in ignored build
artifacts, separate from committed node logs.

Only after these checks, the owner-requested unblock was applied: the daemon
received SIGTERM, exited cleanly and restarted with its existing flags/database.
This discarded the in-memory rejection cache while preserving downloaded data.
The unchanged verifier accepted the formerly blocked transaction and subsequent
blocks. The public regression fixture checks native transaction/blob identity,
round-trip serialization, successful RingCT semantics and rejection of an
altered proof. It does not disable or reinterpret native consensus checks.

The real browser recorded tip progression from 230,389 to 230,469 and a later
reader height of 230,510, with no page errors. The node panel returned to
"Synchronizing" and its error cleared from the live observation. Evidence:
`build/v04-native-smoke/sync-recovery-browser-result.json`,
`sync-replay.log`, `sync-repeat.log` and `sync-generated-proof.log`.

Core pin remains `185dd1fa33ba88c88bb22df9069ad368c0f9a27e`. The initial
cryptographic rejection has not been reproduced by the fresh checks. The
operational block is recovered; this does not establish its original cause,
full current-tip parity or a permanent fix for an unobserved runtime fault.
If the rejection recurs, preserve the exact bytes/error and repeat isolated
verification before choosing a core/build change. Do not automate blind restarts
or disable validation.

See [live health operation](WEB.md#live-node-health-and-error-details) and
[release validation](V0_4_VALIDATION.md).
