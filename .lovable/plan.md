
## Goal
Remove the user-facing sticker "size" picker on Customize. Sticker dimensions are now derived automatically from `container + volume` (already chosen on the Bottle step). Feed those exact dimensions into:
1. The AI prompt (so generation respects real label proportions)
2. The live preview (so the artwork frame matches real-world W × H ratio, with the chosen shape cropping the fully-filled image)

## Files to change

### 1. `src/lib/studio-store.ts`
- Remove `size` from state, `setSize`, `initial`, `reset`, and the `SIZE_CHOICES` export.
- Add a new exported lookup `LABEL_DIMENSIONS` keyed by `container` → `volume` → `{ frontW, frontH, backW?, backH?, neckW?, neckH?, wrapW?, wrapH? }` in centimetres, using the midpoint of each range from the user's spec (e.g. wine 750ml front = 9 × 11 cm).
- Add helper `getLabelDimensions(container, volume)` returning the front-label dims (or wrap dims for cans) — this is the single source of truth used by both prompt and preview.

### 2. `src/routes/studio.customize.tsx`
- Delete the entire "Size" card/section and any `setSize` references.
- Keep shape, text layers, white border.
- Show the auto-derived dimensions read-only inside the existing "Designing for" chip, e.g. *"🍷 Wine bottle · 750ml · label 9 × 11 cm"*.

### 3. `src/components/studio/StickerArtwork.tsx`
- Accept `container` + `volume` (or pre-computed `aspectRatio`) and compute `aspect-ratio: W / H` from `getLabelDimensions`.
- Apply that aspect ratio to the artwork frame.
- Keep the shape mask (rectangle / oval / circle / diecut / square / rounded) as the crop on top of the fully-filled image — image always `object-cover` so it fills the frame edge-to-edge regardless of shape.
- For cans (panoramic wrap), the frame becomes very wide; that's intended.

### 4. `src/routes/studio.preview.tsx`
- Pass `container` + `volume` to `StickerArtwork` so the preview matches real proportions.
- Also surface the dimensions text near the preview ("Print size: 9 × 11 cm").

### 5. `src/routes/studio.create.tsx`
- Pass `container` + `volume` to `StickerArtwork` for the live preview pane (same as above).
- Remove `size` from the `generateSticker` call payload.

### 6. `src/server/generate-sticker.ts`
- Drop `size` from the `Body` type, validator, and prompt.
- Replace the existing rough `ASPECT_HINTS` with a precise, dimension-aware sentence built at request time: *"Compose for a label printed at exactly {W} cm wide × {H} cm tall (aspect ratio {W}:{H}). Every element must be sized and positioned to read clearly at this physical scale on a {volume} {container}."*
- Compute that on the server using a copy of the same `LABEL_DIMENSIONS` table (server can't import from `src/lib` if it would pull client-only code — safe here since the file is plain data, so a shared import is fine).

## Out of scope
- Front vs back vs neck label picker (just use front / wrap for now)
- Imperial unit toggle
- Re-rendering past generations at the new aspect ratio

## Why this works
The bottle + volume already uniquely determines the real-world label rectangle. Exposing a separate "Small / Medium / Large / XL" picker was redundant and could conflict with the chosen bottle. By deriving dimensions from the spec table the user provided, the live preview's frame ratio, the shape crop, and the AI's composition prompt all agree on the same physical target — which is exactly what's needed for the generated artwork to fill the shape correctly without empty space.
