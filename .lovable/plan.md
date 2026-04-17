
## Goal
Insert a new **Step 0: Choose your bottle** before the current "Create" step. User picks a container type (wine, beer, etc.) → then picks a real-world size (e.g. 750ml, 330ml) → then proceeds into the existing prompt/style flow. This makes the journey feel guided and concrete.

## Current flow
`/studio` → `/studio/create` (prompt + style) → `/studio/customize` (shape, size in inches, container) → `/studio/preview` → `/studio/checkout`

Container & sticker-size are currently buried inside Customize. We move container + bottle-volume to the very front and remove the duplication later.

## New flow
1. `/studio` (landing — already exists, "Start designing" CTA)
2. **NEW** `/studio/bottle` — pick container, then pick volume (two-stage on one page)
3. `/studio/create` — prompt + style (unchanged logic)
4. `/studio/customize` — shape, sticker-print-size, text (container picker removed from here)
5. `/studio/preview`
6. `/studio/checkout`

## Changes

### 1. `src/lib/studio-store.ts`
- Add `volume: string | null` to state + `setVolume`.
- Add new export `BOTTLE_VOLUMES` keyed by container id:
  ```
  wine: ["375ml","500ml","750ml","1.5L"]
  champagne: ["200ml","375ml","750ml","1.5L"]
  beer: ["330ml","500ml","660ml"]
  spirits: ["200ml","500ml","700ml","1L"]
  can: ["250ml","330ml","440ml","500ml"]
  growler: ["1L","2L","32oz","64oz"]
  ```
- Update `STEPS` to prepend `{ id: 1, slug: "bottle", label: "Bottle", path: "/studio/bottle" }` and renumber the rest (Create=2, Customize=3, Preview=4, Download=5).
- Include `volume` in `initial` and `reset`.

### 2. `src/routes/studio.bottle.tsx` (NEW)
Two-stage card grid:
- **Stage A**: 6 large container cards (uses existing `CONTAINER_CHOICES`) with emoji + label + short tagline. Click → sets `container`, advances to stage B.
- **Stage B**: shows chosen container at top with "Change" link, then a row of size pills from `BOTTLE_VOLUMES[container]`. Click a size → sets `volume`, "Continue" button enables → navigates to `/studio/create`.
- Heading copy: *"Which bottle are you labelling?"* / *"What size?"*
- Skeleton mirrors `studio.create.tsx` look (cards, hover states, sage gradient accents).

### 3. `src/routes/studio.create.tsx`
- Add a guard: if `!container || !volume`, redirect to `/studio/bottle`.
- Add a small read-only chip at the top showing "Designing for: 🍷 Wine bottle · 750ml" with a "Change" link back to `/studio/bottle`.

### 4. `src/routes/studio.customize.tsx`
- **Remove** the container picker section entirely (it's now chosen earlier).
- Keep shape, print-size (inches), text layers, white border.
- Show the same "Designing for:" chip at top for context.

### 5. `src/routes/studio.index.tsx` (landing)
- Point the "Start designing" CTA to `/studio/bottle` instead of `/studio/create`.

### 6. `src/components/studio/StepIndicator.tsx`
- No code change needed — it reads from `STEPS`. The new 5-step bar will render automatically. Verify spacing still works at sm breakpoint (it uses `flex-1` + `truncate`, should be fine).

### 7. `src/server/generate-sticker.ts`
- Optional but recommended: accept `volume` in the body and append it to the prompt as additional context (e.g. *"label sized for a 750ml wine bottle"*) so the AI tunes proportions. Low risk, additive only.

## Out of scope
- Pricing changes based on volume
- Mockup of actual bottle in preview (future enhancement)
- Persisting selection across sessions

## Technical notes
- New route file naming follows TanStack flat convention: `studio.bottle.tsx` becomes `/studio/bottle` and renders inside `StudioLayout` (the `studio.tsx` layout with `<Outlet />`).
- Guards use `useEffect` + `useNavigate` from `@tanstack/react-router` (matches existing pattern in other studio routes).
- `routeTree.gen.ts` regenerates automatically — do not edit.
