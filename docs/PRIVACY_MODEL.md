# Privacy model

The v0.3 [API v2 contract](API_V2.md) makes hidden output amounts `null`, pool
inclusion height/timestamp `null`, and ring candidates alternatives without a
real-spend marker. Network responses describe this native reader's chain.
Payment IDs/public extra remain public native bytes; encrypted short IDs are
not described as decrypted recipient information. Read-only GETs accept only
bounded public block-list parameters; no private-key input or propagation data
is exposed. Existing [legacy privacy differences](HTTP_SERVER.md) remain explicit.

The active project has native services and an opt-in read-only HTTP subset,
without a browser flow. Its block/transaction/raw/version routes accept no
private keys, wallet uploads, or transaction submission, and omit local pool
receive/relay times. See [HTTP_SERVER.md](HTTP_SERVER.md) for the explicit legacy
privacy differences. Legacy endpoint/browser risks below describe the inspected
upstream reference, not the entire current API. See [IMPORT_SCOPE.md](IMPORT_SCOPE.md).

This document separates observed legacy behavior from modernization requirements.
It is not a claim that the existing explorer already meets every target guarantee.
Source: upstream `2e334724`, inspected 2026-10-04.

## Public chain data and its limits

Public data includes blocks, timestamps, versions, PoW metadata, transaction
hashes, fees, sizes, public output keys/commitments, input key images, ring
membership/global indices, unlock metadata, and transaction extra. Amount
visibility depends on transaction type; coinbase/older clear amounts differ
from confidential RingCT amounts. Do not label hidden amounts as known zero.

Address decoding reveals address format/network and public keys. It does not
provide a public address-to-balance or address-to-transaction-history mapping.
An output's one-time key cannot ordinarily be associated with an address from
public chain data alone. A user-supplied private view key permits additional
inspection; its results are privileged, not public blockchain attribution.

A ring lists public candidates. Neither a ring timeline nor an age distribution
may rank or mark a candidate as the real spend. A key image records a spend under
that image and permits spent/double-spend checks; it does not identify the actual
spent ring member. Public reverse references require a real available index or
bounded native scan, not an invented association.

Legacy clear payment IDs, encrypted IDs, and Ryo uniform IDs have different
visibility/decoding rules. Do not promise searchable private IDs or infer a
recipient relationship. Subaddress/additional-key handling must follow Ryo's
existing native code and verified historical fixtures.

## Existing secret handling

Without `--enable-js`, output decoding/proving runs on the server. POST
`/myoutputs` and `/prove` send private view/transaction keys; GET variants also
put them directly in the path. `/api/outputs` and `/api/outputsblocks` accept
keys in query strings and echo the parsed secret in successful JSON responses.
The result template can display supplied keys and construct shareable verification
information. URL/request logs, browser history, referrers, monitoring, and caches
therefore matter. Do not advertise server mode as keeping keys in the browser.

`--enable-js` changes transaction-page buttons to local handlers. Bundled browser
code uses embedded public transaction data for output derivation, amount decoding,
and proving sending. It does not remove server routes or make unrelated wallet
export/raw tools local. Verify the browser network trace with synthetic keys
before promising that a particular flow sends no secrets.

Wallet output/key-image export checking decrypts user files server-side with a
view key. Such exports can disclose wallet metadata beyond a single transaction.
Raw transaction checking can include wallet archive information and private
transaction keys. These inputs must not become analytics, logs, fixtures, or
support attachments. A private spend key must never be requested for ordinary
explorer verification.

"Prove sending" currently derives outputs using a transaction private key and
recipient address. Do not confuse it with an independently documented proof-string
format or proof of public address balance. Preserve existing Ryo crypto and
document the exact inputs and verification meaning in each future flow.

## Mempool and node metadata

Legacy `MempoolStatus` sorts by receive time and the API exposes it as timestamp.
It is this node's observation, not a chain inclusion timestamp. Some transaction
lookup fallback responses expose it too. Future v2 models must omit precise
first-seen/receive/relay times, source peer/IP data, and propagation information.
Safe public summaries include transaction hash, size, fee, input/output counts,
and aggregate count/size/fees. Aggregation must avoid reconstructing propagation
history. Realtime events should not add local observation timestamps as public
transaction facts.

Network hashrate is an estimate based on chain difficulty/target. Connection and
peer-list counts, uptime, synchronization, and daemon health describe the explorer
node. They do not measure total network peers. Separate these categories in v2,
including snapshot freshness and partial failures.

## Target local verification

Use explicit local browser flows with bundled assets. Communicate: "Verification
is performed locally. Your private view key is not sent to the server." Only show
this statement after the specific implementation and network trace support it.
Never silently fall back to a server form when local verification fails or lacks
a supported transaction version. Prefer transient inputs and avoid persistence
in cookies, local storage, URLs, or telemetry. Browser compromise remains a
different threat from server key exposure; minimize third-party code and assets.

Existing JavaScript crypto needs known historical Ryo transaction/subaddress/ID
fixtures and C++ parity checks. Do not write new cryptographic primitives in
JavaScript/TypeScript. Later, evaluate WASM reuse of Ryo parsing/verification only
where it improves correctness or portability. WASM itself does not establish
privacy and is not required for the baseline.

## Operations and compatibility

No trackers, analytics SDKs, fingerprinting, runtime CDNs, external fonts, or
unnecessary cookies. Bundle assets. Source inspection found local scripts/assets;
it is not proof about production reverse-proxy logs, host configuration, or a
complete absence of tracking across deployments.

Keep transaction pushing optional/default-off and visibly gated. Bound public
queries and expensive crypto/scans, validate inputs, and review escaping and
memory safety. Configure TLS and disable logging of secret-bearing paths/query
strings/bodies at the proxy; never put real secrets in operational examples.
These mitigations do not solve browser history or response echoing.

Legacy privacy fixes need a documented compatibility proposal. Baseline discovery
does not silently remove endpoints. New v2/frontend designs must not inherit the
legacy secret-in-URL contract. Security reporting instructions are in
[SECURITY.md](../SECURITY.md); future API changes are governed by
[DECISIONS.md](DECISIONS.md).
