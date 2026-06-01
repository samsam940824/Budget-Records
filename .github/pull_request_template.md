## What changed


## Why


## How to test
1.
2.
3.

## Security checklist
- [ ] No cross-user data access introduced (queries are still scoped by `auth.uid()` via RLS)
- [ ] New tables have RLS enabled with a `user_id = auth.uid()` policy
- [ ] No secrets, API keys, or `.env` files committed
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## Related issues
Closes #

## Screenshots (UI changes only)
