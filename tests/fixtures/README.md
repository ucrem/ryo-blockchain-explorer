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

The deployed explorer reported `b5ba431`, `topic-css-tlc`, linked Ryo
`0.6.1.0-749a2ad/dev`. It is a reference capture rather than proof of this local
build. The genesis native-parser test verifies the fixed transaction hash and
serialization using Ryo; other JSON captures establish schema/historical
references and do not prove secret-key decoding or signature verification.

These fixtures contain public chain data only. No view keys, transaction private
keys, wallet exports, node-local pool timestamps, or peer metadata are included.
The captured ring members are candidates; none is labeled as the real spend.
Add historical non-coinbase versions, payment-ID/subaddress disclosed-key cases,
different ring sizes, raw blobs, and isolated pool data as they are verified.
