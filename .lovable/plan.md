
## Goal
Make the live preview communicate **real-world label size** so square / rectangle / rounded / die-cut don't all visually look the same. Show the dimensions (W × H) under the preview on every studio step (Create, Customize, Preview/bottle, Checkout) and pass them through to checkout.

## Current state
- `getLabelDimensions(container, volume)` in `src/lib/studio-store.ts` already returns real-world `{ w, h, unit }` for the chosen container + volume (this is what the bottle step writes).
- `StickerArtwork` already uses that ratio for the frame, but the **pixel size on screen is fixed** (`size = 280` etc.), so a 8×10 cm rectangle and a 6×6 cm square render at the same on-screen footprint — misleading.
- No textual dimension label is shown anywhere in the studio.

## Changes

### 1. `StickerArtwork.tsx` — scale on-screen size by real dimensions
- Treat the `size` prop as the **max pixel budget for the largest real-world edge across the whole studio session** (a shared scale).
- When `dims` exist, compute on-screen `width = size * (w / maxEdge)` and `height = size * (h / maxEdge)` where `maxEdge = max(w, h)`. This keeps proportions honest **and** makes a 6×6 square visibly smaller than a 10×12 rectangle when both are rendered at the same `size` budget.
- Add an optional `showDimensions` prop. When true and `dims` exist, render a small caption under the artwork: `8 × 10 cm` (uses `dims.unit`).

### 2. Show the dimension caption on every studio step
Pass `showDimensions` (or render a sibling `<p className="text-xs text-muted-foreground">{w} × {h} {unit}</p>`) under the preview in:
- `src/routes/studio.create.tsx` — Live preview panel
- `src/routes/studio.customize.tsx` — main canvas
- `src/routes/studio.preview.tsx` — bottle mockup (caption goes under the bottle frame, not on the bottle)
- `src/routes/studio.checkout.tsx` — order summary line ("Label size: 8 × 10 cm")

### 3. Checkout carries the spec through
In `studio.checkout.tsx`, add a "Specifications" block in the order summary listing: container, volume, shape, and **label dimensions** (from `getLabelDimensions`). This guarantees the size info the user saw in the preview is what they confirm at purchase.

### 4. Tiny scale legend (Create + Customize only)
Under the dimension caption, add one muted line: *"Shown to scale relative to your bottle choice."* So the user understands why a square looks smaller than a rectangle on screen.

## Out of scope
- Changing the underlying dimension table in `studio-store.ts`
- Adding a manual "size override" — bottle + volume remain the source of truth
- Bottle mockup re-scaling (the bottle photo stays fixed; only the sticker overlay scales)

## Why this works
The user already locked in real-world dimensions when they picked the bottle and volume. The preview just wasn't *honoring* those dimensions visually — every shape rendered at the same pixel footprint. Scaling the on-screen artwork by the real W × H ratio (against a shared max-edge budget) plus a textual caption makes the size difference between square / rectangle / rounded / die-cut immediately obvious, and surfacing the same dimensions on checkout closes the loop end-to-end.
