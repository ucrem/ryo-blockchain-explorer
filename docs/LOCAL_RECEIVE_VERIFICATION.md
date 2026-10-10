# Local received-output verification

## Authorization and problem

The owner requested implementation on 2026-10-10 after reviewing the proposed
transaction hash + address + private view key flow, with secrets kept in the
browser. Existing public inspection tools check membership/encoding only and
cannot decode confidential amounts. This focused capability advances the local
verification milestone; it does not replace the public checks or add a wallet.

## Implementation boundary

Add a dedicated received-output tool and transaction-page entry point. Fetch
only the existing public raw-transaction endpoint using the transaction hash.
Decode the address and transaction bytes, check the hash and recognize/decode
outputs locally using the pinned Ryo C++ implementation compiled to WebAssembly.
Do not implement cryptographic primitives in TypeScript or send the address,
private key, results or derived secrets to an API. Serve all assets locally.

Run computation in a disposable worker with bounded memory, transaction/output
sizes and an execution deadline. Clear the secret input on use/clear/unmount;
terminate workers after completion/cancellation. Avoid forms with a native GET
fallback, URL secret parameters, server actions, storage, logging, telemetry and
automatic clipboard reads. JS strings cannot offer guaranteed memory erasure;
native sensitive buffers receive best-effort wiping and worker disposal limits
their lifetime. A compromised browser/site remains a different threat.

Use native standard/integrated/subaddress handling, additional transaction keys,
historical clear outputs and supported Ryo RingCT types. Check decoded amounts
against their native commitments. Do not claim signature/full-consensus checking.
Reject unsupported versions, malformed data, wrong address/network/view-key
pairs and unavailable modules explicitly; never fall back to server decoding.
Reject Kurz and standard/integrated addresses whose view/spend public keys are
equal before asking for a secret, since their view key can also authorize spending.
Subaddress view-public-key comparison follows its different native derivation.

## User-visible results

Display the requested TX hash/network, a link to current inclusion and confirmations,
matching output indices, exact
nine-decimal RYO amounts and their sum. Other outputs remain undisclosed. Label
the sum as outputs recognized for this address, not spendable balance or proof
of an external payment; it may include change. No match, key/address mismatch,
missing TX, unsynchronized reader, corrupted commitment and unsupported format
are distinct outcomes. Explain how to obtain a private view key in the wallet,
never ask for spend/transaction keys or exports, and do not persist the inputs.

## Compatibility and migration

Keep public API routes, reader/daemon operation and existing public tools intact.
The browser module is a separately reproducible asset with recorded SDK/toolchain
provenance and licenses. No database/index/cache migration, chain scan, transaction
submission or server secret endpoint is introduced. The owner-approved local
flow is the specific exception to the initial no-browser-crypto web foundation.
All source changes use the existing open tools PR; it stays open for owner merge.
Full native CI remains manual-only.

## Validation gates

Use disclosed synthetic keys only. Compare WebAssembly results with native Ryo
for standard/integrated/subaddress/additional-key cases, supported historical
versions/RingCT types, multiple/mixed recipient outputs, exact amounts, wrong
keys, malformed/tampered data and commitment failures. Include public historical
blobs as parser/hash negative-match references without inventing private keys.
Inspect browser requests, URLs, cookies/storage and messages with synthetic
secrets; assert no secret/address/result reaches the server and no GET fallback.
Test cancellation, failures, worker deadlines, mobile/keyboard/accessibility and
existing public-tool behavior. Record actual evidence before completing the PR.

## Rebuilding the bundled assets

Ordinary web builds use the committed native WASM and its small Emscripten loader;
no SDK/toolchain download happens in Node builds or visitors' browsers. To
regenerate, install the official Emscripten SDK 6.0.12 and Boost 1.83.0 headers,
and provide an isolated checkout at scripts/ryo-core-revision.txt:

```sh
bash scripts/build-receive-wasm.sh .deps/ryo-core /path/to/emsdk /path/to/boost/include
```

The script checks the pin, applies only exact reviewed SDK patch combinations
using the existing guard, compiles a minimal source set with native WASM
exceptions and single-thread memory, and records source/asset SHA-256 hashes
in web/public/crypto/manifest.json. It does not compile the wallet, daemon,
LMDB or hardware-wallet dispatch into the browser. Boost is headers only;
BOOST_HAS_PTHREADS exposes SDK header declarations using the single-thread
Emscripten libc stubs, without pthreads or shared memory. Runtime assets and
license notices are served from the website origin.

The memory ceiling is 64 MiB, stack 1 MiB, input blob 4 MiB, public response
8 MiB, outputs 2,048, inputs 1,024, extra 64 KiB and main TX keys 32. Native
allocation/parser failures abort the isolated operation safely. Each worker
has a 15-second deadline; public reads have a 10-second deadline. Larger or
slower cases fail explicitly instead of changing server-side behavior.

Run the native ryo_native_receive CTest to regenerate and compare the disclosed
synthetic fixture corpus with its committed reference, then npm test in web
for exact native/WASM replay and provenance checks. The corpus uses native
output derivation, ECDH and commitment generation plus the independent native
decodeRct/decodeRctSimple decoder as its amount oracle. Signatures/range proofs
are placeholders: these synthetic containers are NOT consensus-valid and
never serve as production chain data. Existing public genesis/v3 transaction
bytes provide native parser/hash/no-match references; no recipient ownership
or private key is invented for them.

## Validation recorded 2026-10-10

- Ubuntu 24.04/GCC 13 rebuilt the explorer and passed all eight native CTests
  (the SDK patch guard was run separately from the other seven). The new
  receive fixture generated and compared 31 deterministic cases.
- Node 24: ESLint and TypeScript checks passed; all 52 unit/parity tests passed.
  The Emscripten module and loader were byte-identical across two complete
  builds with the documented pin/toolchain/flags.
- Production Webpack build passed. Seven focused Playwright scenarios passed,
  including existing public tools, actual browser WASM amount decoding,
  wrong-key/Kurz refusal without TX reads, absent/corrupted data, cancellation,
  worker timeout, no-JS submission absence, page-exit key clearing and mobile Axe checks.
- Browser request/header/body and isolated server traces contained no synthetic
  address, key or decoded amount; browser console, URLs, cookies and local/session
  storage likewise contained none. The secret field had no name or parent form,
  and cleared after use. No browser console errors or external origins occurred
  in the successful local decoding flow.

Emscripten's newer Clang emits inherited SDK anonymous-linkage and legacy
literal-operator declaration warnings in GULPS/fmt/JSON headers. They are
compiler syntax/portability diagnostics, not security findings; no broad warning
suppression or cryptographic changes were introduced. The normal native GCC
build and web lint/type checks remain warning-free. These tests do not establish
full-chain consensus validity, independent inclusion or a general browser
security audit. Full native GitHub Actions remains manual-only.

Screenshots use the disclosed synthetic corpus only: [desktop](images/local-receive-desktop.png),
[dark](images/local-receive-dark.png), [mobile](images/local-receive-mobile.png).
They show test amounts and are not real chain payments. Additional local preview
inspection checks the insecure-HTTP key-entry block and native address worker;
existing public guides retain light/dark/mobile accessibility and contextual
visibility. The running daemon/API services are kept separate from web refreshes.
