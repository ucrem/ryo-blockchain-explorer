# Existing features and HTTP routes

**Scope:** This document inventories the inspected official upstream explorer.
The active project contains selected native C++ components only; its source
boundary is described in [IMPORT_SCOPE.md](IMPORT_SCOPE.md). The legacy HTTP
server, website, and routes below are not shipped by this foundation.

Source: upstream `2e334724`, inspected 2026-10-04. All explicit registrations are
in `main.cpp`; handlers below are in `src/page.h` unless another file is named.
**Implemented** means found in source, not runtime-certified. All optional flags
are false by default in `CmdLineOptions.cpp`. Keep current capabilities pending
fixture-backed refactoring; no feature removal is authorized by this inventory.

## Page and tool inventory

| Feature | Method / route | Handler / location | Data source | Frontend | Status / decision / notes |
| --- | --- | --- | --- | --- | --- |
| Dashboard, latest blocks/transactions | GET `/`, `/page/<uint>` | `index2` | LMDB, derived metadata, cached pool/network, optional emission | `index2.html`, table partials | Implemented; keep, later extract services; optional block cache |
| Block by height/hash | GET `/block/<uint>`, `/block/<string>` | `show_block` overloads | LMDB + Ryo PoW/metadata | `block.html` | Keep; PoW hash/version/nonce/fees/transactions and adjacent links |
| Transaction/basic/expanded details | GET `/tx/<string>`, `/tx/<string>/<uint>` | `show_tx`, `construct_tx_context` | LMDB, pool snapshot, Ryo ring/output parsing | `tx.html`, `tx_details.html` | Keep; optional ring details; cache keyed by expansion flag |
| Output decoding | POST `/myoutputs`; GET `/myoutputs/<string>/<string>/<string>` | `show_my_outputs` | Ryo crypto, chain/pool or submitted raw tx | `my_outputs.html` | Keep capability; propose migration of secret-bearing URL separately |
| Prove sending with tx private key | POST `/prove`; GET `/prove/<string>/<string>/<string>` | `show_prove` → output derivation | Ryo crypto and chain/pool/raw input | `my_outputs.html` | Keep; this is private-key-based checking, not evidence of a general standalone proof-string API |
| Raw transaction form | GET `/rawtx` | `show_rawtx` | Config/templates | `rawtx.html` | Requires `--enable-pusher`; preserve gate |
| Raw transaction decode/check | POST `/checkandpush`, `action=check` | `show_checkrawtx` | Ryo wallet archive/blob parsing, crypto, LMDB | `checkrawtx.html` | Same pusher gate even for checking; separate local/network UX later |
| Transaction submission | POST `/checkandpush`, `action=push` | `show_pushrawtx`, `rpccalls::commit_tx` | Ryo parsing and daemon `/sendrawtransaction` | `pushrawtx.html` | Network-affecting; optional and default-off |
| Key-image export form | GET `/rawkeyimgs` | `show_rawkeyimgs` | Templates | `rawkeyimgs.html` | Requires `--enable-key-image-checker` |
| Key-image export check | POST `/checkrawkeyimgs` | `show_checkrawkeyimgs` | Wallet export decrypt/signature validation + LMDB spent check | `checkrawkeyimgs.html` | Keep; accepts encrypted exported file and view key, not a public reverse-lookup API |
| Output export form | GET `/rawoutputkeys` | `show_rawoutputkeys` | Templates | `rawoutputkeys.html` | Requires `--enable-output-key-checker` |
| Output export check | POST `/checkrawoutputkeys` | `show_checkcheckrawoutput` | Wallet export deserialization/decryption, Ryo crypto, LMDB | `checkrawoutputkeys.html` | Keep; do not confuse wallet export checking with a public key search index |
| HTML search/address metadata | GET `/search?value=...` | `search`, `show_address_details`, integrated-address helper | LMDB transaction/block lookups + Ryo address decode | Transaction/block/address templates | Keep; no balance/history; old auxiliary indexed search is disabled |
| Full mempool | GET `/mempool`, `/txpool` | `mempool(true)` | `MempoolStatus` native-pool snapshot | `mempool.html` | Keep alias; receive-time privacy issue documented |
| Optional auto-refresh | GET `/autorefresh` | `index2(0,true)` | Dashboard sources | Header meta refresh, 10 seconds | Requires `--enable-autorefresh-option`; future SSE needs a separate change |
| CSS | GET `/static/style.css` | `get_js_file("css_styles")` | Startup asset map | Local CSS | Keep; verify content type and static-route precedence |
| Robots policy | GET `/robots.txt` | Inline `main.cpp` | Constant text | Plain text | Implemented; empty Disallow does not protect sensitive tool URLs |
| JavaScript assets | GET `/js/jquery.min.js`, `/js/crc32.js`, `/js/biginteger.js`, `/js/crypto.js`, `/js/config.js`, `/js/nacl-fast-cn.js`, `/js/base58.js`, `/js/cn_util.js`, `/js/sha3.js`, `/js/all_in_one.js` | `get_js_file` / page constructor | Bundled sources, network-adjusted config | Browser scripts | Requires `--enable-js`; bundle assembled at startup; individual cn_util route uses the same map key |
| Static images/files | GET `/static/<path>` | Implicit Crow route, `ext/crow/crow/app.h` | Files under relative `static/` | Header images/icons | Upstream reference only; delivery was checked in discovery, old assets are excluded from the native import |
| API documentation page | GET `/api` | `api` | Template | `api.html` | Requires `--enable-json-api`; legacy reference, no OpenAPI |
| Alternate blocks | No active route (`/altblocks` commented out) | `altblocks`, RPC helper | Daemon alternate-block RPC | `altblocks.html` | Dormant; do not advertise as currently reachable or remove code without review |

GET path parameters for `/myoutputs` are transaction hash, address, view key;
for `/prove` they are transaction hash, address, transaction private key.
POST field names intentionally differ: output decode uses `xmr_address`,
`viewkey`, `tx_hash`, optional `raw_tx_data`; prove uses `xmraddress`, `txprvkey`,
`txhash`, optional `raw_tx_data`. Raw check/push uses `rawtxdata`, `action`,
optional `viewkey`. Export checks use `rawkeyimgsdata` or `rawoutputkeysdata`
and `viewkey`. Preserve these contracts until their replacements are documented.

## JSON API inventory

All 13 endpoints below require `--enable-json-api`. Methods are GET. Detailed
parameters, schemas, units, and errors are in [API_LEGACY.md](API_LEGACY.md).

| Route | Implementation | Data source | Status / decision |
| --- | --- | --- | --- |
| `/api/transaction/<string>` | `json_transaction` | LMDB/pool + Ryo rings/outputs | Keep; public low-level metadata |
| `/api/rawtransaction/<string>` | `json_rawtransaction` | LMDB/pool + Ryo serialization | Keep; raw JSON object, not hex |
| `/api/detailedtransaction/<string>` | `json_detailedtransaction` | `construct_tx_context` → JSON | Keep; tightly coupled to HTML model |
| `/api/block/<string>` | `json_block` | LMDB + Ryo summaries | Keep; height or hash |
| `/api/rawblock/<string>` | `json_rawblock` | LMDB + Ryo serialization | Keep; raw JSON, not blob |
| `/api/transactions` | `json_transactions` | Recent LMDB blocks and txs | Keep; pagination counts blocks despite endpoint name |
| `/api/mempool` | `json_mempool` | Native pool snapshot | Keep legacy contract; future v2 excludes receive times |
| `/api/search/<string>` | `json_search` | Transaction/block lookups | Keep; no implemented key-image/output/payment-ID reverse search |
| `/api/networkinfo` | `json_networkinfo`, `get_monero_network_info` | Cached RPC snapshot + pool counts | Keep; separate chain/network from node facts in v2 |
| `/api/emission` | `json_emission` | Emission worker + native tip calculation | Keep; fails if worker disabled |
| `/api/outputs` | `json_outputs` | Server-side Ryo key derivation/RingCT | Keep capability; sensitive query/response migration needs approval |
| `/api/outputsblocks` | `json_outputsblocks` | Native recent-block scan, optional pool, crypto | Keep; bounded scanning/rate limits need explicit design |
| `/api/version` | `json_version` | Generated explorer/Ryo version + LMDB height | Keep historical key names |

## Cross-cutting capabilities and gaps

| Capability | Existing implementation | Decision / validation need |
| --- | --- | --- |
| Coinbase and historical transaction versions | Ryo parsing; transaction/block templates and API | Preserve; include genesis, historical and current versions |
| Ring members/global indices/key images | Native offset resolution, output-to-transaction metadata, `construct_tx_context` | Preserve public data; never mark a real spent ring member |
| RingCT/Bulletproofs/extra/payment IDs | Ryo C++ helpers, optional browser code; uniform-ID handling in C++ | Preserve; browser/C++ parity and historical fixtures needed |
| Subaddresses | C++ address/additional-key paths and optional JS derivation | Preserve; known-key local fixtures required |
| Emission | `CurrentBlockchainStatus` and Ryo amount/fee helpers | Preserve genesis adjustment; test checkpoint/reorg semantics |
| Development fund | No portal feature; mechanisms found in external Ryo core | Investigate only; no accounting promise |
| TLS | Crow/OpenSSL with configured certificate/key | Keep; reverse-proxy deployment remains practical |
| Testnet/stagenet | CLI enum, data-path suffixes, ports, template/JS flags | Preserve; isolate chain fixtures and API metadata by network |
| Public key-image/output reverse lookup | Spent checks and ring/global-index lookups exist; complete reverse endpoints absent | Benchmark native approaches before adding an index |
| Realtime/analytics/API v2/modern frontend | Not implemented | Follow later milestones; no speculative placeholders |
| Config-aware navigation | Header links optional tools unconditionally | Small behavior correction needs focused tests and compatibility notes |
| Tests/CI/deployment automation | Absent in original tree | Add non-invasive baseline checks; do not label source checks as chain correctness tests |
