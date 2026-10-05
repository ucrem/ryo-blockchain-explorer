# Repository workflow

- Work on focused `work/` branches. All changes, including documentation, go
  through a pull request targeting `main`.
- Never commit or push directly to `main`, bypass its protection, force-push,
  rewrite published history, or push to the official upstream repository.
- Leave pull requests open for the owner to merge on GitHub. Merge a pull request
  only when the owner explicitly instructs you to do so in the conversation.
  Never enable automatic merging or publish a release without the owner's
  explicit approval of that action. Command access and permission to implement
  do not imply this approval.
- Preserve required pull requests. Neither GitHub approving reviews nor CI
  checks are required for merging; the owner's conversational authorization
  controls agent merging.
- The full native GitHub Actions build runs manually only, not on pull requests
  or pushes. Do not restore automatic triggers or required CI without the owner's
  instruction. Run appropriate local checks and record release validation.
- Write repository code, comments, documentation, commits, pull requests, and
  releases in English. Follow `CONTRIBUTING.md` and `docs/RELEASING.md`.
