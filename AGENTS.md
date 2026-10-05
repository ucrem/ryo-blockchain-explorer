# Repository workflow

- Work on focused `work/` branches. All changes, including documentation, go
  through a pull request targeting `main`.
- Never commit or push directly to `main`, bypass its protection, force-push,
  rewrite published history, or push to the official upstream repository.
- Leave pull requests open for the owner's review. Do not merge, enable automatic
  merging, or publish a release without the owner's explicit approval of that
  action. Command access and permission to implement do not imply this approval.
- Preserve required CI and independent reviews. When using `ucrem` to author a
  pull request, explain that GitHub requires a different account to approve it;
  never weaken protection to overcome this limitation.
- Write repository code, comments, documentation, commits, pull requests, and
  releases in English. Follow `CONTRIBUTING.md` and `docs/RELEASING.md`.
