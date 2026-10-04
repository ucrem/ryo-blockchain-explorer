# Security and privacy reporting

Report suspected vulnerabilities privately through
[GitHub private vulnerability reporting](https://github.com/ucrem/ryo-blockchain-explorer/security/advisories/new).
It is enabled for this repository. Do not publish private keys, wallet exports,
sensitive verification inputs, peer metadata, or exploit details in public issues.
No dedicated security mailbox or response SLA has been established.

This unreleased foundation provides native components and tests. It exposes no
public HTTP server, browser verification flow, or transaction submission endpoint.
The library still contains legacy sensitive/submission helpers; review and gate
those functions before using them in a future public service. Imported code has
not undergone a complete security audit. See [PRIVACY_MODEL.md](docs/PRIVACY_MODEL.md)
and [current validation](docs/PHASE0_REPORT.md).

Use only disposable databases and disclosed synthetic keys in tests. Review
untrusted native/HTTP input, raw blobs, wallet formats, JSON, memory boundaries,
logging, rate limits, and privacy-safe serialization when adding a public API.
The documented legacy URL/key/timestamp risks belong to the upstream reference
and must not be reproduced as guarantees of this new project.
