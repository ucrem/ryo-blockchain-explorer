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

Use the reviewed integration branch that actually passed validation; do not
change unrelated target history or assume an existing unrelated `main` branch.
Authenticate `gh` as `ucrem`, verify repository visibility and ancestry, and
never use force push or the upstream remote. Write the final release notes to
a file, then create an annotated tag and push only the intended branch/tag.

```bash
gh api user --jq .login
gh repo view ucrem/ryo-blockchain-explorer --json nameWithOwner,isPrivate
git tag -a v0.1.0 -m 'Release v0.1.0: modern baseline'
git push origin HEAD
git push origin v0.1.0
gh release create v0.1.0 --repo ucrem/ryo-blockchain-explorer \
  --verify-tag --title 'v0.1.0 — Modern Baseline' \
  --notes-file build/release-notes-v0.1.0.md
gh release view v0.1.0 --repo ucrem/ryo-blockchain-explorer \
  --json url,publishedAt,tagName,isDraft
```

The notes file must exist and be reviewed before publication. Attach only
artifacts that have been validated, together with checksums and dependency/license
information. A failed release command must not be reported as publication.
Do not overwrite an existing tag/release or publish a pre-release baseline under
the final v0.1.0 name just to meet the roadmap.
