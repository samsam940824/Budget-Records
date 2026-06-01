# Contributing to Budget Records

Thanks for taking the time to contribute. This project is small and maintained by one person, so the rules here are intentionally lightweight — the goal is to keep things readable, secure, and self-hostable.

## Ground rules

- Be kind. Assume good faith.
- Discuss non-trivial changes in an issue **before** opening a large PR.
- Don't introduce paid services or required SaaS dependencies beyond Supabase. Self-hostability is a feature.
- Don't add tracking, analytics, or third-party scripts.

## Ways to contribute

- **Bug reports** — Open an issue using the bug template. Please include reproduction steps, expected vs. actual behavior, and your browser / OS.
- **Feature requests** — Open an issue describing the use case before writing code. Not every request will be accepted; this app is intentionally small.
- **Pull requests** — See below.
- **Docs** — Typo fixes, clearer setup instructions, and screenshot contributions are very welcome.

## Development workflow

1. Fork the repo and create a topic branch from `main` (`feat/csv-export`, `fix/budget-rollover`, etc.).
2. Set up the project — see [README.md](./README.md#getting-started).
3. Make your change. Keep PRs focused: one logical change per PR.
4. Run `npm run lint` (type-check) and `npm run build` locally before pushing.
5. Open a PR against `main`. Fill in the description: what changed, why, and how to test.

### Coding conventions

- **TypeScript strict**, no `any`. Use `unknown` + type guards if you must.
- **React 19 + Composition API style hooks**. Keep components small and single-purpose.
- **Tailwind v4** for styling. Avoid custom global CSS unless unavoidable.
- **Supabase access should stay in `src/data/`, `src/hooks/`, or auth-specific modules** — components should not call `supabase` directly. Data-layer modules under `src/data/` own the queries; hooks compose them and expose state to components.
- **No `console.log` in committed code.** Use it during development, remove before pushing.
- Money uses `number` today; if you touch arithmetic-sensitive paths, prefer integer cents over floats.

### Commit messages

Short, imperative, English or 繁體中文 both fine. Conventional-Commits-style prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`) are appreciated but not enforced.

## Database / Supabase changes

- Schema changes go in `supabase/migrations/` as new, additive SQL files. Don't edit `0000_schema.sql` once it's been applied to existing forks.
- Every new table must have RLS enabled and a `user_id = auth.uid()` policy. PRs that add tables without RLS will be rejected.

## Reviewing PRs

When reviewing, I look at, in order:
1. Does it match the project's scope? (small, self-hostable, no telemetry)
2. Does it respect RLS and not leak other users' data?
3. Is the type model clean? Any `any` / silent `as` casts?
4. Is it readable in 6 months without comments explaining what?

## Releasing

Releases are tagged from `main` (`v0.1.0`, `v0.2.0`, …) and published via GitHub Releases. The GitHub Pages deploy is triggered on every push to `main`, so the demo always reflects `main`, not the latest tag.

## Code of Conduct

Be respectful. Harassment, discrimination, or personal attacks are not tolerated and will result in a ban from the repo.
