# Legacy API reference

**Scope:** This document inventories the inspected official upstream explorer.
The active project contains selected native C++ components only; its source
boundary is described in [IMPORT_SCOPE.md](IMPORT_SCOPE.md). The legacy HTTP
server, website, and routes below are not shipped by this foundation.

Inventory of upstream `2e334724` on 2026-10-04. All handlers are in
`src/page.h`; route registration and query extraction are in `main.cpp`.
These are existing contracts, not an API v2 proposal. The public deployed
explorer was checked for genesis block/raw-block/transaction and version responses;
local runtime validation is recorded separately in [the discovery report](PHASE0_REPORT.md).

## Common behavior

Enable with `--enable-json-api`; the source default is **false**, despite the
old README help example showing true. All 13 JSON routes use GET. `/api` itself
is an HTML documentation page, not a JSON endpoint. There is no OpenAPI document.

Responses use JSend:

```json
{"status":"success","data":{}}
```

Failures commonly use `{"status":"fail","data":{"title":"..."}}`;
errors can use `{"status":"error","message":"...","data":{}}`.
`data` begins as `json {}` and can remain null. Handlers generally return an
ordinary Crow response without selecting an HTTP error code: inspect the JSend
status even when HTTP is 200. Some uncaught exceptions have different behavior;
do not promise complete error uniformity. `myxmr::jsonresponse` adds
`Content-Type: application/json`, wildcard CORS, and allowed header
`Content-Type`. No explicit OPTIONS routes, authentication, rate limiting, or
API-specific size limit are registered here.

Hashes are hex strings. Monetary values are atomic units (Ryo helpers use
10^9 atomic units per coin). Timestamps are epoch seconds, and UTC strings
use the existing formatter. JavaScript callers must preserve large integers
without rounding; do not change legacy numeric representation silently.
Block height is a zero-based index; `current_height` is the chain block count.
Some empty collections are null, while others are arrays.

String parameters pass through `remove_bad_chars`, then handler-specific parsing.
Query selection uses regular-expression matching of the raw URL, not a complete
typed query schema. Numeric bounds, overflow, malformed/missing inputs, and
expensive scans need explicit runtime tests. Do not treat character filtering as
input validation or escaping.

## Shared transaction summary

`get_tx_json` produces `tx_hash`, `tx_fee`, `mixin`, `tx_size`, `xmr_outputs`,
`xmr_inputs`, `tx_version`, `rct_type`, `coinbase`, `extra`, `payment_id`, and
`payment_id8`. `tx_size` is serialized bytes. `mixin` is the legacy decoy-count
field; consumers must not relabel it as ring size without checking the helper.
Hidden RingCT amounts cannot be interpreted as publicly known zero-value outputs.
Empty payment-ID strings mean no matching legacy ID; these fields do not fully
describe the Ryo uniform-payment-ID extension handled elsewhere.

## Endpoint contracts

### GET `/api/transaction/{hash}`

Handler: `json_transaction` (source line 4298). Required path: transaction hash.
Uses `find_tx`, native LMDB/Ryo transaction parsing, or the cached local pool.
Adds `timestamp`, `timestamp_utc`, `block_height`, `confirmations`,
`current_height`, `outputs`, and `inputs` to the shared summary.
Output entries contain `public_key`, `amount`; input entries contain
`key_image`, `amount`, `mixins`; each mixin contains `public_key` and `block_no`.
Coinbase inputs can be null. Unconfirmed metadata uses pool receive time and
legacy defaults for chain fields: it is not a canonical block timestamp.

Compatibility: preserve field names, integer units, confirmations convention,
and null behavior. The ring members do not identify the real spent output.
Privacy: unconfirmed timestamps disclose node-local observation time.

### GET `/api/rawtransaction/{hash}`

Handler: `json_rawtransaction` (4464). Required hash; LMDB or pool + Ryo
`obj_to_json_str`, parsed through nlohmann JSON. `data` is the serialized Ryo
transaction object (version, unlock time, inputs, outputs, extra, RingCT/signature
structures according to transaction version). **This returns JSON, not raw hex.**
Compatibility follows linked Ryo serialization and historical transaction types;
do not flatten or discard fields. Untrusted raw JSON parsing and response size
need regression/limits review.

### GET `/api/detailedtransaction/{hash}`

Handler: `json_detailedtransaction` (4543). Required hash; finds the chain/pool
transaction, calls `construct_tx_context`, and converts its mstch context to JSON.
Removes selected HTML-only keys, including `timescales`, `tx_json`, `tx_json_raw`,
ring-display toggles, errors, and construction/server times. Remaining fields
include formatted transaction/header data and inputs/outputs/ring metadata.
The exact schema is coupled to the template context and optional configuration;
`construct_tx_context` is its canonical specification until golden captures exist.
Dependencies: Ryo objects, native ring/global-index reads, mstch visitor conversion.
Privacy: ring data is public candidate membership; pool times may be node-local.
Compatibility: this is not a stable independent DTO and must be captured before extraction.

### GET `/api/block/{height-or-hash}`

Handler: `json_block` (4596). Numeric height or 64-character block hash.
Uses native chain lookup and shared transaction summaries. `data` contains
`block_height`, `hash`, `timestamp`, `timestamp_utc`, `size`, `txs`,
`current_height`; `txs` starts with the miner transaction. `size` uses the Ryo
database block-size accessor rather than an independently defined v2 metric.
Failed height/hash lookup returns JSend fail/error. Preserve genesis support,
ordering, height/count semantics, and the existing size definition.

### GET `/api/rawblock/{height-or-hash}`

Handler: `json_rawblock` (4739). Same identifier rules as block lookup; LMDB +
Ryo serialization. `data` is the native block JSON object: `major_version`,
`minor_version`, `timestamp`, `prev_id`, `nonce`, `miner_tx`, `tx_hashes`.
It does not embed all non-miner transaction objects and does not return a hex blob.
Compatibility: preserve native serialization; bound response/input costs.

### GET `/api/transactions?page=0&limit=25`

Handler: `json_transactions` (4835). Optional zero-based page and limit; limit
counts **blocks**, not transactions, and is capped at 100. Data contains
`blocks`, `page`, `limit`, `current_height`, `total_page_no`. Block entries contain
`height`, `hash`, `age`, `size`, `timestamp`, `timestamp_utc`, `txs`; summaries
include each block's coinbase and ordinary transactions. Ordering/pagination uses
tip-relative arithmetic; capture boundary cases before refactoring.
`total_page_no` uses integer division, not a modern ceiling page count.
Dependencies: LMDB, Ryo transaction parsing, age formatting.
Security: zero/huge pages and multiplication/subtraction overflow need tests;
the 100-block cap does not bound total transaction response bytes.

### GET `/api/mempool?page=0&limit=100000000`

Handler: `json_mempool` (4959). Optional page/limit. The very large default
intentionally returns the whole pool; no explicit small upper cap exists here.
Data: `txs`, `page`, `limit`, `txs_no`, `total_page_no`. Transactions use shared
summaries plus `timestamp`/`timestamp_utc` from **local receive time**.
Dependencies: mutex-protected `MempoolStatus` snapshot; Ryo summaries.
Compatibility: pagination and receive-time ordering are existing behavior;
plan any legacy privacy remediation explicitly. Future v2 must omit receive/relay
and source-peer metadata. Failed pool refresh can leave stale contents.

### GET `/api/search/{query}`

Handler: `json_search` (5063). A 64-character candidate is searched first as a
transaction hash, then a block hash; a shorter-than-12-character candidate is
tried as block height. Successful data reuses that endpoint's payload with
`title: "transaction"` or `title: "block"`. No match returns fail/title.
Dependencies: native transaction/block paths and pool fallback. There is no
implemented public key-image, output-key, payment-ID, or address-balance search
through this endpoint. Preserve type/precedence until v2 is documented.

### GET `/api/networkinfo`

Handler: `json_networkinfo` (5531), `get_monero_network_info`.
No parameters. Returns cached RPC-derived fields: `status`, `current`, `height`,
`target_height`, `difficulty`, `target`, `hash_rate`, `tx_count`, `tx_pool_size`,
`alt_blocks_count`, `outgoing_connections_count`, `incoming_connections_count`,
`white_peerlist_size`, `grey_peerlist_size`, `testnet`, `stagenet`,
`top_block_hash`, `cumulative_difficulty`, `block_size_limit`,
`block_size_median`, `start_time`, `fee_per_kb`, `current_hf_version`.
Adds `tx_pool_size_kbytes` and replaces pool count with native pool atomics.
Despite its name, `tx_pool_size_kbytes` receives **bytes** from the worker.
`fee_per_kb` is a hard-coded 500,000; hashrate is difficulty / target.
The grey peer-list field is present in the response but not populated in the
inspected worker path. Failure to obtain current network information returns error.

Dependencies: background daemon `get_info`/`hard_fork_info` RPC, local-pool state.
Peer counts, connection counts, daemon uptime, and freshness describe this node,
not all Ryo peers. Preserve legacy fields/units; define truthful v2 network/node
sections rather than silently correcting the old schema.

### GET `/api/emission`

Handler: `json_emission` (5568). No parameters; also requires
`--enable-emission-monitor`. If disabled, fail/title says the thread is not
enabled. Success data: `blk_no` (last included block), `coinbase` (net minted
amount after fees/genesis adjustment), `fee` (accumulated transaction fees), in
atomic units. Dependencies: scanner/checkpoint plus native tip-gap calculation.
Compatibility: preserve Ryo genesis correction and distinguish checkpoint progress
from current supply. Deep reorg/error handling requires additional tests.

### GET `/api/outputs?txhash=...&address=...&viewkey=...&txprove=0`

Handler: `json_outputs` (5128). Required `txhash`, `address`, `viewkey`.
`txprove` is optional 0/1 (default false); when true the misleadingly named
`viewkey` is a transaction private key used for proving sending.
Data: `outputs` entries (`output_pubkey`, `amount`, `match`, `output_idx`),
`tx_hash`, `address` as hex-encoded parsed public address, **`viewkey` echoed
as parsed secret-key hex**, and `tx_prove`. Chain/pool + Ryo key derivation and
RingCT decoding; do not infer unmatched hidden output amounts.

Security/privacy: GET query strings can expose secrets through logs, history,
caches, and referrers; responses echo secrets. Never include real keys in public
fixtures/bug reports. Browser mode does not disable this endpoint. Preserve the
capability while proposing an explicit secret-handling/API migration; do not copy
this design into v2 or use it for default frontend verification.

### GET `/api/outputsblocks?limit=3&address=...&viewkey=...&mempool=0`

Handler: `json_outputsblocks` (5345). Required address and private view key;
optional last-block count (default 3) and `mempool` 0/1 (default false).
Scans recent native chain blocks and optionally the cached pool using Ryo crypto.
Data: matching `outputs` entries (`output_pubkey`, `amount`, `block_no`,
`in_mempool`, `output_idx`, `tx_hash`, `payment_id`), parsed-hex `address`,
echoed **`viewkey`**, `limit` as a string, `height`, `mempool` boolean.

No explicit small scan cap exists here. Check tiny chains, limit boundaries,
underflow, and concurrent expensive queries. This privileged view-key scan is
not public address history. Secret query/response risks are the same as `/outputs`.
Compatibility: preserve existing types until a documented replacement exists.

### GET `/api/version`

Handler: `json_version` (5612). No parameters. Data: `last_git_commit_hash`,
`last_git_commit_date`, `git_branch_name`, `monero_version_full` (actually linked
Ryo version), `api` (packed legacy version integer), `blockchain_height`.
Dependencies: generated `version.h`, Ryo version symbols, LMDB height.
The API version is independent of future product Semantic Versioning; do not
rename the Monero-era key without an explicit breaking-change decision.

## Compatibility validation before any extraction

Capture all read-only JSON endpoints on a pinned local database, including
genesis, historical/current ordinary transactions, coinbase, RingCT, empty pool,
invalid hashes, page boundaries, and disabled-feature behavior. Normalize only
documented volatile fields; preserve numeric/string/null distinctions. Use
synthetic disclosed test keys for secret-bearing tools in an isolated test
environment. Do not run submission tests against public mainnet.

Known legacy exposure remains documented, not approved as a future privacy
guarantee. A proposed removal, timestamp reduction, response-type correction,
or parameter rename needs a migration notice and explicit compatibility review.
