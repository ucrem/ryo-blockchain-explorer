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
- Preserve required pull requests and CI. GitHub approving reviews are not
  required; the owner's conversational authorization controls agent merging.
- Write repository code, comments, documentation, commits, pull requests, and
  releases in English. Follow `CONTRIBUTING.md` and `docs/RELEASING.md`.
