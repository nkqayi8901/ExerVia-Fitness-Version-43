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
1. Add Sentry browser SDK script globally in hosting template or bootstrap entry.
2. Set `REACT_APP_SENTRY_DSN` in deployment env vars.
3. Verify a test error appears in your monitoring dashboard.

## 4) Auth and Abuse Controls

In Supabase dashboard:
- Verify email rate limits and sign-in protections.
- Confirm session timeout settings are appropriate.

