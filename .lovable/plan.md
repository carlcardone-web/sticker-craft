
## Fix the login black screen and Google auth error

**What’s happening**

There are two separate auth outcomes in the project right now:

1. **Email/password login** is reaching the backend and failing with `invalid_credentials`, which means the form works but the entered email/password combination is not being accepted.
2. **Google login** is using `supabase.auth.signInWithOAuth({ provider: "google" })`, and the response `Unsupported provider: provider is not enabled` indicates the Google OAuth flow is not correctly enabled for the environment being used.

Because this project runs on Lovable Cloud and is currently **not published**, Google sign-in in preview is especially likely to fail unless it is wired through Lovable Cloud’s managed OAuth flow.

## What to change

### 1. Replace direct Google OAuth calls with Lovable Cloud managed OAuth
Update both auth pages so Google sign-in no longer uses the raw Supabase client.

**Files:**
- `src/routes/login.tsx`
- `src/routes/signup.tsx`

**Change:**
- Replace `supabase.auth.signInWithOAuth({ provider: "google", ... })`
- Use the Lovable Cloud auth client (`lovable.auth.signInWithOAuth("google", ...)`) instead
- Keep the existing redirect behavior after successful auth

This aligns the app with the project’s backend/auth environment and avoids the unsupported-provider path currently returning the black screen.

### 2. Add graceful error handling for OAuth failures
The current flow can surface a raw JSON error screen. Add safer handling so users stay in the app and see a toast or inline error instead of a blank/black screen.

**Implementation details:**
- Wrap Google auth launch in defensive handling
- If the auth client returns an error, show a user-friendly message
- Avoid navigating away unless the OAuth flow actually redirects

### 3. Ensure Google auth is enabled through Lovable Cloud tooling
Because this project does not yet have the Lovable Cloud auth integration files, the Google provider should be reconfigured using the social auth tooling rather than hand-written client code.

**Expected result:**
- Lovable-managed OAuth files are scaffolded
- Google sign-in is connected using the supported auth path for this stack

### 4. Verify preview-vs-published behavior
This project currently has **no published URL**. If Google auth still fails after moving to the managed flow, treat preview-only failure as an environment issue rather than an app-code bug.

**Plan:**
- Publish the project
- Test Google sign-in on the published URL
- If it works there, keep the code and document preview limitations
- Do not change redirect URIs or invent custom OAuth workarounds for preview-only failures

### 5. Keep email/password auth as the fallback path
The network logs show email/password requests are functioning technically, but the credentials entered were rejected.

**No code fix needed for that specific error unless desired**, but I would:
- keep the email/password flow intact
- improve the login error message copy so users understand it is a credential problem, not an app crash

## Files likely involved

- `src/routes/login.tsx`
- `src/routes/signup.tsx`
- generated Lovable auth integration files (via tooling, not manual editing)

## Technical notes

- Current issue source for Google login: direct use of `supabase.auth.signInWithOAuth(...)`
- Recommended path for this project: Lovable Cloud managed OAuth client
- The black screen is the external OAuth error surfacing directly instead of being contained in the app UI
- Email/password is not broken at the transport level; the backend is returning a standard invalid-credentials response

## Expected outcome

After this change:
- Google sign-in uses the supported auth path
- users no longer see the raw black-screen JSON error
- preview/published behavior can be separated cleanly
- email/password remains available even if Google auth is temporarily unavailable
