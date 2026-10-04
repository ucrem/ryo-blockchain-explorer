# Architecture decisions

Status: accepted modernization constraints; implementation remains incremental.
Recorded: 2026-10-04. See [the migration plan](MODERNIZATION_PLAN.md).

| ID | Decision | Reason / consequence |
| --- | --- | --- |
| ADR-001 | Ryo blockchain LMDB remains the source of truth. | Reuse native indexes and Ryo interpretation; derived caches are disposable. |
| ADR-002 | No mandatory PostgreSQL initially. | Establish measurements before adding operational requirements. |
| ADR-003 | No Redis, Kafka, queues, Kubernetes, or unnecessary microservices. | Start with selected native components, then a focused C++ API and frontend. |
| ADR-004 | Next.js, TypeScript, Tailwind CSS, and shadcn/ui for the future web application. | Begin only after discovery and the legacy build are validated. |
| ADR-005 | Server Components by default. | Add browser components only for interactivity and local verification. |
| ADR-006 | Prefer SSE for future realtime updates. | Current events are primarily server-to-browser; use WebSockets only for a demonstrated bidirectional need. |
| ADR-007 | Preserve C++ Ryo parsing, cryptography, and blockchain interpretation. | Extract real code into services; do not create empty service classes or reimplement crypto in TypeScript. |
| ADR-008 | Introduce `/api/v2/` alongside the legacy `/api/` endpoints. | Document contracts and compatibility impact before changing or removing legacy behavior. |
| ADR-009 | No speculative Proof-of-Stake implementation. | Support the current Ryo Proof-of-Work chain; no staking UI, validator schemas, or consensus placeholders. |
| ADR-010 | Future public mempool data excludes node-local receive/relay timestamps and propagation metadata. | Existing legacy timestamp exposure is documented; remediation needs an explicit compatibility decision. |
| ADR-011 | Add an auxiliary index only after benchmarks show native queries are insufficient. | Evaluate existing indexes, query implementation, and embedded stores first. |
| ADR-012 | Consider PostgreSQL only for measured relational/historical analytics needs. | Do not duplicate the chain wholesale. |
| ADR-013 | Preserve local verification and keep sensitive keys in the browser where supported. | Audit existing browser code against historical Ryo fixtures; never silently fall back to sending secrets. WASM is optional later. |
| ADR-014 | No trackers, runtime CDNs, external fonts, fingerprinting, or unnecessary cookies. | Bundle and self-host application assets. |
| ADR-015 | Publish usable, validated Semantic Versioning releases. | Every release needs tests, documentation, changelog, Git tag, and a real GitHub Release. Do not tag an incomplete baseline. |
| ADR-016 | Keep native Ubuntu development supported. | Docker is optional; temporary build environments are validation aids, not mandatory deployment infrastructure. |
| ADR-017 | Keep transaction submission separately configurable and disabled by default. | Read-only inspection and network-affecting actions need distinct UI and operational controls. |
| ADR-018 | Independent repository with a selective native C++ import. | User explicitly chose reusable native components, tests, and documentation without the old website/templates. Preserve provenance/history; bring coupled legacy logic over in focused increments. |

Substantial architecture or behavior changes require a proposal covering current behavior,
affected components, compatibility, migration risk, and tests, followed by approval.
Mechanical build fixes, discovery documentation, and non-invasive tests can proceed.
