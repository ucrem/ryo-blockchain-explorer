# Release procedure

Use Semantic Versioning for modernization releases. A tag alone is insufficient:
every release includes a published GitHub Release with its publication timestamp.
No v0.1.0 tag/release should be created while mandatory baseline checks are open.
The user-selected native-only scope refines v0.1.0 to a development foundation
with compiled reusable components and real native tests. Release notes must
clearly state that the old website/HTTP server is excluded. The v0.1.0 native
foundation passed the documented build/fixture/CI gates; later releases must
repeat checks appropriate to their changes.

## Gates

- All release changes reach `main` through an approved pull request with the
  required checks. The repository owner explicitly approves integration and
  release publication; broad implementation or command authorization does not
  replace these approvals. Never bypass protection or push directly to `main`.
- Target repository is public, owned by `ucrem`, and has the original upstream
  history; `origin` and `upstream` point to their documented repositories.
- Implementation is complete for the milestone, with a successful Ubuntu 24.04
  build, tests, CI results, and local read-only runtime verification.
- Historical fixtures, optional-feature behavior, compatibility, and known
  security/privacy limitations have been reviewed.
- README/build/API/contributor docs and a dated `CHANGELOG.md` release entry
  describe the final change accurately.
- Release notes explain Added/Changed/Fixed/Security/Deprecated as applicable,
  plus Upgrade Notes/Known Issues where needed. Keep implementation evidence in
  development docs rather than turning release notes into a test transcript.

## Publish

Prepare the implementation and release notes on a focused branch, open a pull
request targeting `main`, and leave it open for review. Merge through GitHub only
after the owner explicitly approves integration and branch protection is
satisfied. GitHub requires an independent reviewer when the pull request author
is `ucrem`; the author cannot approve their own pull request.

After approval to publish, fetch the merged `main` commit and verify that the
intended release changes and successful required checks are present. Authenticate
`gh` as the intended publishing account, verify repository visibility and
ancestry, and never use force push or the upstream remote. Write the final release
notes to a file, create an annotated tag at the approved commit, and push only
that tag. The example below is the publication step, after review and approval;
it must not push a branch or substitute for the pull request workflow.

```bash
gh api user --jq .login
gh repo view ucrem/ryo-blockchain-explorer --json nameWithOwner,isPrivate
git fetch origin main
git tag -a v0.2.0 origin/main -m 'Release v0.2.0: native services and read-only HTTP'
git push origin v0.2.0
gh release create v0.2.0 --repo ucrem/ryo-blockchain-explorer \
  --verify-tag --title 'v0.2.0 — Native Services and Read-only HTTP' \
  --notes-file build/release-notes-v0.2.0.md
gh release view v0.2.0 --repo ucrem/ryo-blockchain-explorer \
  --json url,publishedAt,tagName,isDraft
```

The notes file must exist and be reviewed before publication.
Before copying the example, select an unused intended version; never rerun it
against a published tag. v0.1.0, v0.2.0, and v0.3.0 are already published.

Attach only artifacts that have been validated, together with checksums and dependency/license
information. A failed release command must not be reported as publication.
Do not overwrite an existing tag/release or publish a pre-release baseline under
the final v0.1.0 name just to meet the roadmap.
