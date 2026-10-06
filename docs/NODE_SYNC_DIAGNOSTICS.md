# Node synchronization failure diagnosis

## Observed failure on the current development node

The native reader stops after block 230,109 (RPC chain height 230,110), while
`ryod` remains running, reconnects and reports a much higher peer target.
The repeated protocol-level error is:

```text
transaction verification failed on NOTIFY_RESPONSE_GET_OBJECTS
```

The logged `tx_id` is produced by `get_blob_hash`, not the transaction's
consensus hash. It must not be passed to a transaction lookup as though confirmed.
The UI labels it "Transaction blob identifier". No peer addresses or precise
node error-time records are stored in this report.

Inspecting the initial failure batch gives more useful native diagnostics:

```text
Verification failure at step 1
rct signature semantics check failed
```

The pinned core's `rct::bulletproof_VERIFY` returns false because its first
combined verification equation does not produce the point at infinity
(`src/ringct/bulletproofs.cc:1160`). The `RCTTypeSimple`/`RCTTypeBulletproof` branch
of `core::check_tx_semantic` reports the second message
(`src/cryptonote_core/cryptonote_core.cpp:816`). The batch then emits the
protocol transaction failure. The initial batch is consistent with the observed
RingCT/Bulletproof failure; the detailed messages do not themselves contain the
blob identifier, so they are not an independent hash attribution.

After semantic verification fails, `handle_incoming_tx_post` places the
transaction hash in the in-memory `bad_semantics_txes` cache. Later downloads
are rejected by `handle_incoming_tx_pre` before repeating cryptographic checks.
This explains why subsequent retries can show only the protocol message.
The live panel reports recent recognized messages actually read from the log;
it does not inject this historical diagnosis into later unrelated failures.

Core pin: `185dd1fa33ba88c88bb22df9069ad368c0f9a27e`. The existing Ubuntu 24.04
compatibility patch does not change the Bulletproof/RingCT verifier. No
consensus bypass, daemon restart, database reset/rewind or dependency upgrade
has been performed. This identifies the failing check; it does not establish
why it fails or prove that the historical chain transaction is invalid.

## Next diagnostic steps

1. Obtain the exact downloaded blob in an isolated diagnostic process, retaining
   public bytes outside committed node logs, and compute both native blob and
   transaction identifiers. Match the logged blob before drawing conclusions.
2. Replay its native parsing and RingCT/Bulletproof check in a fresh process,
   independent of the daemon's bad-semantics cache. Keep the live daemon running.
3. Compare the same public bytes and check with an independently built supported
   native daemon. Distinguish reproducible proof rejection, different peer bytes,
   and a build/runtime verification fault before selecting a fix.
4. Only then change the implementation/dependency under a reviewed compatibility
   proposal if needed. Never disable verification or delete chain data to make
   the dashboard appear to advance.

The web health change is independently validated. Actual current-tip sync and
release readiness remain unresolved until this native failure is diagnosed.
See [live health operation](WEB.md#live-node-health-and-error-details) and
[release validation](V0_4_VALIDATION.md).
