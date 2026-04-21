

## Fix the login redirect loop

**What's happening**

When you hit `/studio/checkout` while logged out, `RequireAuth` sends you to `/login?redirect=/studio/checkout`. But each subsequent click (or any nav back to `/login`) re-wraps the current URL into a new `redirect=` param, producing the absurd `/signup?redirect=/login?redirect=/login?redirect=…` chain currently in your address bar. Signup/login also never strip a `redirect` that points back to themselves, and they don't bounce already-authenticated users away — so the loop self-perpetuates and the form never gets a chance to submit cleanly.

**Fixes**

1. **Sanitize the `redirect` param in `/login` and `/signup`**
   - In `validateSearch`, if the incoming `redirect` is missing, starts with `/login`, or starts with `/signup`, drop it (treat as `/`).
   - This single change collapses any pre-existing nested URL like the one you're on now back to a clean `/login`.

2. **Use a relative path, not `location.href`, in `RequireAuth`**
   - Change `redirect={location.href}` to use just `location.pathname + location.search` (no protocol/host). This avoids ever round-tripping a full URL through the search param.

3. **Bounce authenticated users away from `/login` and `/signup`**
   - Add a small effect (using `useAuth`) on both pages: if `isAuthenticated`, `navigate({ to: redirect || "/" , replace: true })`. Prevents the case where a logged-in user landing on `/login` re-triggers a redirect dance.

4. **Use `replace: true` on post-auth navigation**
   - In login/signup `handleSubmit` and `RequireAuth`'s `<Navigate>`, use `replace` so the auth pages don't pile up in browser history.

5. **One-time recovery for users already stuck**
   - Because step 1 ignores any `redirect` starting with `/login`, simply reloading the page after deploy will land users on a clean `/login` — no manual URL editing needed.

**Files touched**

- `src/routes/login.tsx` — sanitize `validateSearch`, add authenticated bounce, `replace: true` on navigate.
- `src/routes/signup.tsx` — same treatment.
- `src/components/RequireAuth.tsx` — switch to `pathname + search`, add `replace`.

**Out of scope**

No changes to Supabase auth config, OAuth redirect URIs, or the server-fn auth interceptor — those are working correctly. This is purely a client-side routing bug.

