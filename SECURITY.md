# Security Policy

## Supported versions

This project is currently pre-1.0. Only the latest `main` branch and the most recent tagged release receive security fixes.

| Version | Supported |
|---|---|
| `main` / latest release | ✅ |
| Older tags | ❌ |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately via one of:

1. **GitHub Security Advisories** — preferred. Go to the repo's [Security tab → "Report a vulnerability"](https://github.com/samsam940824/Budget-Records/security/advisories/new). This creates a private advisory only the maintainer can see.
2. **Email** — `sam-940824@hotmail.com` with the subject prefix `[security] Budget-Records:`.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce, or a minimal proof-of-concept.
- The commit SHA or release version you tested against.
- Whether the issue is exploitable on the public demo (`samsam940824.github.io/Budget-Records/`) or only on self-hosted deployments.

## Response expectations

This is a personal open-source project — there is no paid security team. Expect:

- **Acknowledgement** within 7 days.
- **Initial assessment** within 14 days.
- **Fix or mitigation timeline** communicated after assessment. Critical issues affecting the public demo will be prioritized.

If 30 days pass without acknowledgement, you are welcome to escalate by opening a *generic* public issue ("security report awaiting response") that does **not** disclose the vulnerability details.

## Scope

In scope:

- Anything in this repository.
- The public demo deployment at `https://samsam940824.github.io/Budget-Records/`.

Out of scope:

- Vulnerabilities in Supabase itself — report those to [supabase.com/security](https://supabase.com/security).
- Vulnerabilities in upstream npm dependencies — please report them to the upstream maintainers; we'll bump versions once a fix is available.
- Issues that require a compromised user device or browser extension.
- Denial of service via volume of traffic.

## Disclosure

Once a fix is released, the reporter is credited in the release notes unless they prefer anonymity. Coordinated disclosure timing will be agreed before the advisory is made public.

## Threat model

A repo-specific threat model documenting assets, trust boundaries, and mitigations is maintained at [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md). It is reviewed before every minor release and whenever the architecture changes.

## Known security-relevant design notes

- All multi-tenant data is protected by Postgres Row Level Security; the anon key is intentionally exposed to the browser. Any RLS bypass is a critical issue.
- The app has no server of its own — it is a static SPA. There are no server-side secrets to leak from this codebase. Self-hosters are responsible for their own Supabase project's secret management.
