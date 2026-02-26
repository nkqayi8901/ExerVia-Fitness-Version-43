# Production Hardening Checklist

## 1) Secrets and Environment Variables

1. Create a local `.env` from `.env.example`.
2. Set:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
   - optional `REACT_APP_SENTRY_DSN`
3. Confirm `.env` is not committed (`.gitignore` includes `.env`).

## 2) RLS Verification

Run `docs/rls_audit.sql` in Supabase SQL editor against production.

Pass criteria:
- No public tables with `rls_enabled = false`.
- No RLS-enabled tables without policies.
- No unsafe public write policies unless intentionally designed.

## 3) Error Monitoring

App now includes monitoring hooks:
- route crashes via `ErrorBoundary`
- global `window.error`
- global `window.unhandledrejection`

If using Sentry:
1. Choose one integration path:
   - Script tag path: load browser SDK globally so `window.Sentry` exists.
   - Bundled path: install `@sentry/browser` (or `@sentry/react`) and initialize it in app bootstrap.
2. Set `REACT_APP_SENTRY_DSN` in deployment env vars.
3. Verify a test error appears in your monitoring dashboard.

Note:
- Current `src/services/errorMonitoring.js` uses `window.Sentry` when present.
- If you use the bundled npm path, either expose `window.Sentry` or update `errorMonitoring.js` to import and use the SDK directly.

## 4) Auth and Abuse Controls

In Supabase dashboard:
- Verify email rate limits and sign-in protections.
- Confirm session timeout settings are appropriate.
