# Node synchronization failure and native correction

## Current result and limits

The development daemon was rebuilt with the pinned native core and the reviewed
[point-identity patch](../scripts/patches/ryo-point-identity.patch). A graceful
restart preserved the existing mainnet database. The daemon accepted block
238,751, which had stopped progress, and continued synchronizing. The native API
was rebuilt against the same archives; the website remains on its existing build.

The correction fixes a reproducible defect in the native point-identity
predicate. Its direct responsibility for the two intermittent daemon failures
has **not** been reproduced in isolated replay. Runtime observation, described
below, establishes bounded recovery rather than full current-tip parity or a
permanent resolution of every possible verifier fault. No chain reset, rewind,
validation bypass, dependency upgrade or automatic restart loop was used.

## Two failure boundaries

The unchanged daemon first stopped after block 230,109 (chain height 230,110).
Two public mainnet RPC nodes returned identical block bytes and all seven full
transaction blobs for the next block. Native parsing identified the logged blob
as transaction `c133f8d2a67df074f683115156fd3eddb4481bef1b68666171932bb46950fce0`,
with blob identifier
`d921a38e147c8d782c1000d1350cc400e045d828dba98fea04471b631651c45c`.
The initial batch logged Bulletproof `Verification failure at step 1` and
`rct signature semantics check failed`; later downloads repeatedly logged:

```text
transaction verification failed on NOTIFY_RESPONSE_GET_OBJECTS
```

Fresh native replay passed all seven transactions and 300 sequential/concurrent
checks of the rejected blob. A controlled restart of the unchanged executable
cleared its in-memory rejection cache and resumed progress. That operational
recovery did not eliminate the recurrence: after another 8,641 blocks, the daemon
stopped after block 238,750 with a different rejected blob.

The second boundary's next block is 238,751, hash
`bb06f3d4a14d70f831461cebec398cf6d773fec6ae5b87459628eafcb84becb4`.
Its ten public transactions replay successfully. The logged blob
`0493d486575cb5732308956c82a4deb284b85db32a810ea9f3d889e4c949bde9`
maps natively to transaction
`64bab57b60c5efa5a3d8cba6f079e333269c376ed6ef809d94426c8aac78314f`.
The initial batch logged Bulletproof step 2 and the same semantic failure.
A fresh 30,000-check replay of the old predicate did not reproduce rejection.
Instrumentation captured no canonical-identity/predicate mismatch in that run.

Initial Bulletproof/RingCT messages do not themselves include transaction
identifiers. Their batch context is consistent with the rejected blob, but is
not independent hash attribution. The protocol log identifier uses native
`get_blob_hash`, distinct from the consensus transaction hash; the UI labels it
accordingly. Exact public bytes are preserved in two regression fixtures, with
no peer addresses, pool receipt times or private keys.

## Why retries remained blocked

After a semantic rejection, `handle_incoming_tx_post` records the consensus
transaction hash in the in-memory `bad_semantics_txes` cache.
`handle_incoming_tx_pre` immediately rejects later copies without rerunning the
proof verifier. This explains persistent retries following the initial failure.
The cache and all semantic checks remain intact; recovery is not implemented by
removing the cache or retrying until a failed transaction is accepted.

## Reproducible native defect and correction

`ge_p3_is_point_at_infinity` compared ten raw limbs of X/T with zero and Y with Z.
Field elements have multiple equivalent representations. Native encoding maps
carried/modulus-zero coordinates and equivalent Y/Z representations to the
identity bytes `01...00`, while the old predicate returns false. It also accepts
invalid all-zero projective coordinates. The permanent service test fails on the
old SDK with `Equivalent carried-zero X rejected.`

The separate patch uses the existing native `fe_isnonzero` and `fe_sub` helpers
to compare X = T = 0 and Y = Z modulo the field prime, requiring nonzero Z.
It rejects nonidentity points, order-two torsion, nonzero X/T and invalid zero
projective coordinates. It changes a native implementation predicate; proof
equations, scalar/range checks and the required identity point remain unchanged.
No frontend cryptography or new consensus rule is introduced.

The build helper accepts a clean pinned SDK, the exact existing compatibility
patch, or the exact pair of reviewed patches. It rejects and preserves unrelated
tracked/staged changes. Operators must rebuild daemon and explorer archives and
restart their native processes with the existing database; see [build setup](BUILD.md).
The core pin remains `185dd1fa33ba88c88bb22df9069ad368c0f9a27e`.

## Validation and runtime evidence

- The old SDK fails the new coordinate test; the patched SDK passes it and all
  five native/schema/HTTP CTests in 26.42 seconds.
- All 17 public transactions from the two boundaries pass fresh native replay.
  Both committed fixtures check exact transaction/blob hashes, native round-trip
  serialization, positive RingCT semantics and rejection of an altered proof.
- The patched verifier passes 30,000 fresh sequential/concurrent checks with
  zero failures. Generated proofs for 1, 2, 3, 4, 7, 8, 9, 15 and 16 outputs pass;
  altered proofs are rejected.
- The pinned upstream `cncrypto` vector test passes in 9.21 seconds. All 179
  selected upstream Bulletproof, public-blob, multiexponentiation, RingCT and
  Crypto tests pass in 27.67 seconds, including aggregate and torsion cases.
- Build-helper probes accept clean, exactly patched and compatibility-only SDKs;
  unexpected tracked and staged changes are rejected without overwriting them.

Local evidence remains in ignored artifacts: `build/v04-point-identity-*`,
`build/v04-core-guard-probe-result.json`,
`build/v04-point-identity-upstream-{crypto,proof}-tests.log` and
`build/v04-native-smoke/{sync-replay-fixed.log,sync-fixed-stress.log,sync-generated-proof-fixed.log}`.
A production Chromium browser observed displayed tips 242,370 through 242,590
without manual reload, with zero page errors and the panel showing
"Synchronizing". The second rejected transaction is confirmed in block 238,751.
A later status sample reports chain height 247,931 (stored tip 247,930): another
9,180 blocks beyond the previous boundary, exceeding the prior 8,641-block
restart-to-recurrence interval, with no new verification errors. This is bounded
runtime evidence, not full-chain validation.

Browser and continuing daemon observations are recorded separately in
`point-identity-browser-result.json` and `point-identity-sync-observations.json`.
Precise node observations and peer records are not committed.

If another failure appears, preserve its exact bytes and initial verifier
context. Inspect the failing equation/point before attributing it to this fix;
do not automate blind restarts or disable validation.
See [live health operation](WEB.md#live-node-health-and-error-details),
[correction proposal](POINT_IDENTITY_FIX_PROPOSAL.md) and
[release validation](V0_4_VALIDATION.md).
