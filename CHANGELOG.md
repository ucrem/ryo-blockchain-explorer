# Changelog

Modernization releases follow Semantic Versioning and Keep a Changelog categories.
Upstream history remains preserved; it is not assigned modernization versions
retroactively.

## [Unreleased]

### Added

- Optional read-only native query diagnostics with disposable offline execution
  and a documented genesis-only measurement reference.
- A concrete v0.2.0 service/HTTP proposal for architectural review; implementation
  remains pending approval and is not part of this preparation change.

## [0.1.0] - 2026-10-04

### Added

- Selected native C++ implementations for LMDB, Ryo parsing/metadata, daemon RPC,
  mempool/network snapshots, and existing emission calculation.
- A CMake static-library build with pinned official Ryo dependencies and isolated
  Ubuntu 24.04 compiler compatibility fixes.
- Real public Ryo fixtures, native parser/hash checks, and disposable offline
  integration tests for the imported implementations.
- Ubuntu 24.04 CI, discovery/API/privacy documentation, import provenance, roadmap,
  and public contributor/security/release guidance.

### Changed

- The active repository is a native foundation for the new project. The old HTTP
  server, website/templates/browser assets, and unrelated vendored libraries are
  excluded. Legacy feature/API inventories remain reference documentation.

### Fixed

- Required native Ryo modern compiler/library compatibility and explicit C++14
  selection, without changing cryptographic or consensus algorithms.

### Known Issues

- No HTTP explorer or frontend is currently provided by this foundation.
- Historical/browser parity, full-chain/reorg/performance, checkpoint behavior,
  and testnet/stagenet coverage remain follow-up work.
- v0.1.0 follows the user-selected native-only foundation scope; HTTP services
  and frontend delivery remain later milestones.

[0.1.0]: https://github.com/ucrem/ryo-blockchain-explorer/releases/tag/v0.1.0
