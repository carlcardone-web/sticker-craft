
## Goal
Persist every studio decision (bottle/volume, prompt, references, generated image, shape, text layers, framing transform, white border) across step navigation and page refreshes so the user never loses work moving between Bottle → Create → Customize → Preview → Checkout.

## Diagnosis
`useStudio` (Zustand store in `src/lib/studio-store.ts`) is **in-memory only**. State survives client-side route transitions (since the store lives at module scope) but is **lost on refresh, tab reopen, or SSR hydration mismatch**. Additionally, the **reference photos** uploaded on `/studio/create` (with their roles) are held in *local component state* inside `studio.create.tsx` — they are not in the global store at all, so navigating away from Create and back loses them entirely. Same pattern likely applies to the prompt's `@mention` bindings.

## Changes

### 1. Promote reference photos into the global store (`src/lib/studio-store.ts`)
Add to `StudioState`:
- `referenceImages: { id: string; url: string; role: string }[]` (max 3)
- `addReferenceImage`, `updateReferenceImageRole`, `removeReferenceImage`, `clearReferenceImages`
This makes them survive step navigation just like `prompt` and `imageUrl` already do.

### 2. Persist the entire store to `localStorage` (zustand `persist` middleware)
Wrap the store with `persist` from `zustand/middleware`:
- Key: `lovable-studio-v1`
- Storage: `createJSONStorage(() => localStorage)` guarded for SSR (`typeof window !== "undefined"`)
- `partialize` to only persist serialisable user data: `container`, `volume`, `prompt`, `stylePreset`, `imageUrl`, `shape`, `textLayers`, `whiteBorder`, `imageTransform`, `referenceImages`. Skip transient/derived state.
- Bump `version: 1` so we can migrate later if the schema changes.

### 3. Wire `studio.create.tsx` to read/write references from the store
Replace the local `useState` for reference uploads with the new store actions. Keep the upload UI identical. The `MentionTextarea` already takes references as a prop — just point it at the store.

### 4. SSR safety
TanStack Start renders routes on the server. The persisted store must:
- Not read `localStorage` during SSR (the `persist` middleware handles this — server snapshot will be empty defaults; client rehydrates after mount).
- Avoid hydration mismatch by ensuring the preview panels gracefully render their "empty" state on the server pass and hydrate to real values on the client (no extra work needed because the store starts from `initial` defaults on both sides; persist replays after mount).

### 5. Add a "Start over" affordance
Now that state is sticky, expose a small **Reset studio** button in `StudioLayout` (top-right, next to step indicator) that calls `useStudio.getState().reset()` and clears persisted storage. Prevents users being stuck with stale data from a previous session.

### 6. Reset rules (unchanged behaviours, made explicit)
- Generating a new image still resets `imageTransform` (already in store).
- Changing container resets `volume` if it's no longer valid for the new container (small guard in `setContainer`).

## Out of scope
- Server-side persistence (would need auth + a `studio_drafts` table — flag as a follow-up if you want cross-device drafts).
- Migrating older persisted snapshots beyond v1.
- Persisting uploaded reference *files* (we only store the object URLs / data URLs already produced by the upload step; if those are blob URLs that die on refresh, we'll convert them to data URLs at upload time so they survive).

## Why this works
Two-layer fix: (a) move the only piece of state that *wasn't* in the global store (reference photos) into it, so client-side navigation already preserves everything; (b) add `persist` so the whole studio session survives refreshes and tab reopens. The user can now freely jump between Bottle, Create, Customize, Preview, and Checkout — and even close the tab — without losing their bottle choice, prompt, references, generated image, framing, text layers, or shape.
