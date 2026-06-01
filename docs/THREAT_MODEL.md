# Threat Model — Budget Records

This document captures the assets we care about, who might attack them, and the controls we rely on. It is meant to be a living document — update it whenever architecture changes.

## System summary

Budget Records is a static SPA (React + Vite) talking directly to a Supabase project (Postgres + Auth) from the browser. There is **no first-party backend**. All multi-tenant isolation is enforced inside Postgres via Row Level Security (RLS).

```
[Browser]  --HTTPS-->  [Supabase Auth]
[Browser]  --HTTPS-->  [Supabase REST/Postgres] -- RLS --> rows where user_id = auth.uid()
```

## Trust boundaries

1. **User ↔ browser** — anything in the browser is reachable by the user. Treat the anon key and JWT as exposed by design.
2. **Browser ↔ Supabase** — TLS-protected. Supabase enforces auth and RLS.
3. **Maintainer ↔ Supabase project** — service role key and project settings are out-of-band; never committed.

## Assets and risks

| Asset | Risk | Mitigation |
|---|---|---|
| Personal finance records (`records`, `budgets`, `categories`, `payment_methods`, `user_settings`) | Cross-user data leak via missing or broken RLS | Every table has RLS enabled with `auth.uid() = user_id`. Migrations reviewed for RLS before merge. New-table PR checklist. |
| Supabase **anon** key | Misunderstood as a secret and over-protected, or worse: confused with the **service role** key | README + SECURITY.md state explicitly that the anon key is browser-safe iff RLS is on; service role key must never appear in this repo. |
| Supabase **service role** key | Full DB bypass if leaked | Never committed. Not used by the app at all. Excluded from `.env.example`. |
| Public demo deployment | Users may enter real financial data into a shared project | README warns users to use throwaway credentials on the demo. |
| SQL migrations | RLS bypass via a new table without policies; destructive change | Additive-only migrations; new tables must add RLS in the same file; reviewed in PR. |
| Auth flow | Session hijack via stolen JWT; account takeover via weak password reset | Rely on Supabase Auth defaults (rotating JWT, password reset via email). Self-hosters should enable email confirmation + rate limits. |
| Frontend inputs (description, location, category name) | Stored XSS via untrusted text rendered as HTML | React escapes by default; no `dangerouslySetInnerHTML` is used in the app. PR checklist forbids introducing it without review. |
| Dependencies (`@supabase/supabase-js`, `react`, `recharts`, …) | Supply-chain compromise via malicious version bump | Lockfile committed (`package-lock.json`). Dependabot / manual `npm audit` reviewed before release. |
| CI deploy secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) | Secret leak via PR from fork | Secrets are only available to workflows running on `main`. Pages deploy workflow does not run on `pull_request` events from forks. |
| GitHub Pages hosting | Repo or Pages takeover | 2FA on the maintainer account. No third-party Actions outside the `actions/` org without pinned SHAs. |

## Threat actors

- **Curious authenticated user** — tries to read other users' data via the REST API. Stopped by RLS.
- **Anonymous attacker** — probes the demo for missing RLS, key leaks, or open endpoints. Stopped by RLS + the anon key being intentionally public.
- **Malicious contributor** — opens a PR that disables RLS, adds tracking, exfiltrates env vars, or pins a malicious dependency. Mitigated by required maintainer review and the PR security checklist.
- **Compromised upstream dependency** — handled by lockfile pinning and periodic audit; no automated `npm install` in production runtime (build is at CI time).

## Out of scope

- Denial of service against Supabase or GitHub Pages (handled by upstream providers).
- Compromise of the user's own device, browser, or Supabase account credentials.
- Cryptographic attacks on TLS.
- Physical access to the maintainer's machine.

## Open items

Tracked as issues:

- Documented Supabase RLS hardening guide for self-hosters.
- Automated check that every table in `public` has RLS enabled.
- Dependabot configuration for `npm` + GitHub Actions.

## Review cadence

This document should be re-read before every minor release (`vX.Y.0`) and whenever a migration adds a new table, a new third-party service is integrated, or a new authentication path is introduced.
