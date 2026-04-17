
The user wants Replicate Flux available to all visitors using *their* (the project owner's) `REPLICATE_API_KEY` — no per-user key entry. The secret already exists in the project.

Currently `studio.create.tsx` has a "Connect Replicate" UX gate (`replicateUnlocked` state, KeyRound icon, toast asking the user for a token). That whole gating layer needs to go since the key lives server-side and is shared.

The server function `src/server/generate-sticker-replicate.ts` already reads `process.env.REPLICATE_API_KEY` — no change needed there.

## Changes

**`src/routes/studio.create.tsx`**
- Remove `replicateUnlocked` state and the "Connect Replicate" button.
- Remove `KeyRound` import and the locked-state styling on the Replicate toggle.
- Replicate toggle becomes always-enabled; clicking it just calls `setProvider("replicate")`.
- Keep the Fast/High quality toggle and the existing engine segmented control layout.
- Update the small hint text under the Upload tab (still note that style transfer on uploads stays Lovable-only).

That's the only file touched. Server function and store stay as-is.
