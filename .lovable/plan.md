
Restrict the studio to **beverage containers only**. Looking at the preview area in `studio.create.tsx` / `StickerArtwork.tsx`, beverage-relevant containers are: **Wine bottle, Beer bottle, Champagne bottle, Spirits bottle, Can, Growler**. I'll need to confirm what the preview actually renders before finalizing the list.

**Plan:**

1. **`src/lib/studio-store.ts`**
   - Replace `CONTAINER_CHOICES` with beverage-only options (e.g. Wine bottle, Beer bottle, Champagne bottle, Spirits bottle, Can, Growler — final list matched to whatever `StickerArtwork` actually previews).
   - Default `container` stays `"wine"`.

2. **`src/server/generate-sticker.ts`**
   - Update `CONTAINER_HINTS` map to match the new beverage-only set, with prompt language tailored to beverage labels (e.g. *"Designed as a beer bottle label — proportions suited to a curved bottle"*).
   - Drop laptop / waterbottle / notebook / other entries.

3. **`src/routes/studio.checkout.tsx`**
   - If it still references the old container list (laptop, notebook, etc.), trim it to the beverage set or remove the container picker entirely (since it's already chosen in Create).

**Files I'll verify first** before editing: `StickerArtwork.tsx` (to match preview options) and `studio.checkout.tsx` (to see if it duplicates container choices).

**Out of scope:** Shape, size, prompt, references, customize, preview — all unchanged.
