
## Diagnosis

For Can / 330ml the bottle's real-world label is **21 × 11.5 cm** (a wrap label, very wide). In `StickerArtwork.tsx`:

- **Rectangle** uses dims as-is: `21 × 11.5`, `maxEdge = 21` → renders at e.g. 280 × 153 px.
- **Square** collapses to `min(21, 11.5) = 11.5`, then recomputes `maxEdge = 11.5` → renders at the **full 280 × 280 px**.

So the 11.5 cm square ends up *bigger on screen* than the 21 × 11.5 rectangle's height, which is exactly what your screenshot shows. The shapes are correct geometrically, but the **scale reference resets per shape** instead of being shared.

## Fix 1 — Shared scale reference (`StickerArtwork.tsx`)

Always normalise on-screen size against the **bottle's natural max edge** (the real `dims.w` / `dims.h` of the rectangle label), regardless of which shape is selected:

```
const bottleMaxEdge = dims ? Math.max(dims.w, dims.h) : 1;   // e.g. 21 for can/330ml
// after computing realW, realH for the chosen shape:
const width  = Math.round(size * (realW / bottleMaxEdge));
const height = Math.round(size * (realH / bottleMaxEdge));
```

Result on Can / 330ml at `size = 280`:
- Rectangle 21 × 11.5 → 280 × 153 px
- Square 11.5 × 11.5 → **153 × 153 px** (clearly smaller — matches reality)
- Circle 11.5 → 153 × 153 px circle
- Rounded 11.5 → 153 × 153 px

This is the only change needed for the scaling bug.

## Fix 2 — Click-to-edit on the live preview

Currently the live preview's "click to edit" navigates to `/studio/customize`, but customize only exposes text/border controls — no way to reposition or resize the underlying image inside the sticker frame. Add image transform controls so the click actually lets the user re-frame the artwork.

### a) Extend the store (`src/lib/studio-store.ts`)
Add `imageTransform: { scale: number; offsetX: number; offsetY: number }` (defaults `{ scale: 1, offsetX: 0, offsetY: 0 }`) and a `setImageTransform` action. Reset it when a new image is generated.

### b) Apply transform in `StickerArtwork.tsx`
On the `<img>` element apply `transform: translate(${offsetX}%, ${offsetY}%) scale(${scale})` and `transform-origin: center`. Keeps `object-cover` so it still fills, but the user can pan/zoom within the crop.

### c) Add an "Edit framing" UI on `/studio/customize`
Above the existing text-layers panel, add a small section:
- **Zoom** slider (0.8× – 2.5×) → updates `scale`
- **Horizontal** slider (-50 → +50) → `offsetX`
- **Vertical** slider (-50 → +50) → `offsetY`
- **Reset** button → back to `{1, 0, 0}`

Optional polish: drag-to-pan on the artwork itself (mousedown + pointermove updates offsets). Keep sliders as the always-available fallback.

### d) Persist through preview & checkout
`StickerArtwork` already reads from the store-driven props chain, so the transform will automatically show on `/studio/preview` and the checkout summary thumbnail with no extra wiring.

## Out of scope
- Changing the real-world dimension table
- Cropping/exporting the transformed image server-side (the transform is a CSS preview; checkout still ships the full generated image — we can flag a follow-up to bake the crop into the final export if you want)
