# Public Ryo fixtures

Captured 2026-10-04 from the official public explorer,
`https://explorer.ryo-currency.com`. JSON files retain the JSend envelope and
response numeric/string/null types. `current_height` and confirmations reflect
capture time and must not be compared as immutable chain facts.

| Fixture | Source |
| --- | --- |
| `genesis-block.json` | `/api/block/0` |
| `genesis-raw-block.json` | `/api/rawblock/0` |
| `genesis-transaction.json` | `/api/transaction/ef9edde12f78ce1776ce1886b3e448d8f3575bc25111231370989baeae4a2d88` |
| `genesis-raw-transaction.json` | `/api/rawtransaction/ef9edde12f78ce1776ce1886b3e448d8f3575bc25111231370989baeae4a2d88` |
| `genesis-transaction.hex` | Official Ryo core `185dd1fa`, `src/cryptonote_config.h`, `config<MAINNET>::GENESIS_TX`; paired with the public genesis hash |
| `ringct-v3-transaction.json` | `/api/transaction/a432b907878c1915e4a4ee0bd15ae54ce9fdb540addb7f8e4591d05ee3ad78c9` (block 1197093) |
| `ringct-v3-raw-transaction.json` | `/api/rawtransaction/a432b907878c1915e4a4ee0bd15ae54ce9fdb540addb7f8e4591d05ee3ad78c9` |
| `ringct-v3-transaction.hex` | Public `wallet-node.ryo-currency.com:12211/gettransactions`, read-only lookup of the same recorded transaction hash, 2026-10-04 |
| `mainnet-block-1.hex`, `mainnet-block-1-header.json` | Public node `/json_rpc`, `get_block` height 1, 2026-10-04; hash `82e8f378ea29d152146b6317903249751b809e97c0b6655f86e120b9de95c38a` |

The deployed explorer reported `b5ba431`, `topic-css-tlc`, linked Ryo
`0.6.1.0-749a2ad/dev`. It is a reference capture rather than proof of this local
build. The genesis native-parser test verifies the fixed transaction hash and
serialization using Ryo; other JSON captures establish schema/historical
references and do not prove secret-key decoding or signature verification.

The added public-node blobs were fetched over HTTP; no secret input was supplied.
The native service fixture independently parses, hashes, and round-trips the
version-3/RingCT transaction (4,599 bytes), comparing metadata with the earlier
official explorer capture. It parses the block-1 blob (123 bytes), checks its
recorded native hash, and covers the historical version-2 coinbase. These checks
preserve serialization and interpretation, not full consensus/signature validation.

Storage-transition tests use a separate disposable LMDB with the real genesis,
historical block, and ordinary transaction. A modified block-1 container is used
only to exercise confirmation/reorg state. It is explicitly synthetic and does
not claim a valid mined block or a public-chain confirmation for that transaction.
Temporary pool receive/relay values never enter public fixtures or responses.
An appended storage-only block has a timestamp thirty seconds before its
predecessor to verify signed interval arithmetic, window filtering, bounded
coverage and removed-anchor handling. It is not a consensus-valid mining fixture.

These fixtures contain public chain data only. No view keys, transaction private
keys, wallet exports, node-local pool timestamps, or peer metadata are included.
The captured ring members are candidates; none is labeled as the real spend.
Add historical non-coinbase versions, payment-ID/subaddress disclosed-key cases,
different ring sizes, raw blobs, and isolated pool data as they are verified.
