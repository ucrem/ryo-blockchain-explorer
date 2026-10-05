# Contributing

This is a public Ryo Currency project. Code, comments, documentation, issues,
commits, pull requests, and releases are written in English. Preserve existing
upstream attribution and licensing notices. No company-specific governance or
internal templates apply.

Read [the current architecture](docs/ARCHITECTURE_CURRENT.md),
[feature inventory](docs/FEATURE_MATRIX.md), [privacy model](docs/PRIVACY_MODEL.md),
and [migration plan](docs/MODERNIZATION_PLAN.md) before replacing functionality.
See [build setup](docs/BUILD.md) and [testing](docs/TESTING.md).

Use short-lived, focused branches such as `work/ubuntu-24-build` or
`work/block-service`. Separate dependency/build changes from service
extraction and UI changes. Keep the native foundation buildable. Never rewrite
published history, force-push, or push changes to the official upstream remote.

All changes, including documentation, must reach `main` through a pull request.
Never commit or push directly to `main`, bypass branch protection, or enable
automatic merging. Leave pull requests open for the repository owner to merge on
GitHub, or merge only after the owner explicitly instructs you to do so in the
conversation. Permission to run commands or implement a milestone does not
authorize merging its pull requests or publishing a release.

`main` requires a pull request and resolved review conversations. GitHub approving
reviews and CI checks are not required for merging; the owner's conversational
authorization controls agent merging. These rules apply to administrators; force
pushes and branch deletion are blocked.

The full Ubuntu 24.04 native build is manual-only, through `workflow_dispatch`;
do not run it automatically on pull requests or pushes. Run local checks
appropriate to the change and record the results. The smaller API contract check
runs automatically only when its relevant files change. Release validation still
requires the documented native build and test evidence.

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
