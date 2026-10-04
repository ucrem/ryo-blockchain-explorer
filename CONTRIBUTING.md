# Contributing

This is a public Ryo Currency project. Code, comments, documentation, issues,
commits, pull requests, and releases are written in English. Preserve existing
upstream attribution and licensing notices. No company-specific governance or
internal templates apply.

Read [the current architecture](docs/ARCHITECTURE_CURRENT.md),
[feature inventory](docs/FEATURE_MATRIX.md), [privacy model](docs/PRIVACY_MODEL.md),
and [migration plan](docs/MODERNIZATION_PLAN.md) before replacing functionality.
See [build setup](docs/BUILD.md) and [testing](docs/TESTING.md).

Use short-lived, focused branches such as `fix/ubuntu-24-build` or
`refactor/block-service`. Separate dependency/build changes from service
extraction and UI changes. Keep the native foundation buildable. Never rewrite
published history, force-push, or push changes to the official upstream remote.

Substantial architecture/behavior proposals must describe current behavior,
the problem, proposed solution, affected components, compatibility, migration
risks, and tests before implementation. Do not add empty abstractions or new
infrastructure based on assumptions. Measure first. Preserve Ryo C++ crypto,
historical interpretation, native LMDB access, and network selection.

Pull requests should explain the user-visible result, implementation, checks
actually run, limitations, compatibility, and risks. Include screenshots for UI
changes. Link canonical documentation rather than copying lengthy design notes.
Tests need real public Ryo fixtures or disclosed synthetic test keys; never
commit real private keys, wallet exports, peer IPs, or node propagation records.
Disclose security problems through [SECURITY.md](SECURITY.md).
