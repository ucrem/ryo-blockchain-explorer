# Ryo Explorer web application

The v0.4 server-first dashboard uses Next.js, TypeScript, Tailwind and shadcn/ui.
It reads the existing native API v2; it has no legacy templates, browser crypto,
synthetic production data or external runtime asset CDN.

See [operation and configuration](../docs/WEB.md),
[validation evidence](../docs/V0_4_VALIDATION.md) and
[the API contract](../docs/API_V2.md). Use Node.js 24 LTS and the npm lockfile.

```bash
npm ci
cp .env.example .env.local
NEXT_TELEMETRY_DISABLED=1 npm run dev -- --hostname 127.0.0.1
```

The native server must separately run with `--enable-api-v2`.
`RYO_API_URL` is server-only and defaults to `http://127.0.0.1:8081`.

```bash
npm run lint
npm run typecheck
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
npm run start -- --hostname 127.0.0.1
```

Browser verification uses `npx playwright install --with-deps chromium` and
`npm run test:e2e`. Full native CI is manual-only; no frontend build runs
implicitly on each PR or merge. Follow the repository's PR and owner-approval
workflow in [CONTRIBUTING.md](../CONTRIBUTING.md).
