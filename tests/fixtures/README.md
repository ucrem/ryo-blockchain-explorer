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

## Recovered historical sync boundary

`ringct-sync-recovery-transaction.hex` was captured on 2026-10-06 through two
public mainnet daemon RPC `/get_transactions` reads for transaction
`c133f8d2a67df074f683115156fd3eddb4481bef1b68666171932bb46950fce0`.
Both returned the same full 2,849 bytes and block height 230,110. Independent
`get_block` reads returned the same block blob/hash
`022e67fafd62c841bd1e29ead82a4d9d9b3218fae5f8b57caaec5677c9b42589`.
RPC reads used HTTP and no secrets. Source peer addresses and observation records
remain outside committed fixtures.

The native test verifies transaction/blob identifiers, round-trip serialization,
valid RingCT/Bulletproof semantics and rejection after altering the proof. This
extends the earlier interpretation-only checks with a narrow native semantic
verification regression; it does not prove the input-ring signatures or full
block consensus. See [recovery evidence](../../docs/NODE_SYNC_DIAGNOSTICS.md).

`ringct-sync-recurrence-transaction.hex` adds the public transaction
`64bab57b60c5efa5a3d8cba6f079e333269c376ed6ef809d94426c8aac78314f`
from mainnet block 238,751, fetched over public daemon RPC on 2026-10-06. Its
native blob identifier is
`0493d486575cb5732308956c82a4deb284b85db32a810ea9f3d889e4c949bde9`,
matching the second rejected blob. Native identity/serialization and positive/
altered-proof semantics are checked alongside the earlier public fixture. No
source peer or local receive-time records are committed.
