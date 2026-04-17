
Reorder the studio flow so **container + size + shape** are picked first (in Create), and the AI uses them as generation hints. This eliminates the cropped/watermarked feel by generating artwork that fills the chosen silhouette from the start.

**New flow:**
```
Create  →  Customize (text only)  →  Preview  →  Download
 ├─ Container (wine / can / laptop / ...)
 ├─ Size (2" / 3" / 4" / 5")
 ├─ Shape (circle / square / rectangle / rounded / oval / diecut)
 ├─ Prompt + Style + References
 └─ Generate
```

**Changes:**

1. **`src/lib/studio-store.ts`**
   - Add `StickerSize = "2in" | "3in" | "4in" | "5in"` + `size` state (default `"3in"`) + `setSize`
   - Export `SIZE_CHOICES` and `CONTAINER_CHOICES` (move container metadata here so Create can use it; today it lives in checkout)
   - `container` already exists — keep it, just default-pick it earlier

2. **`src/routes/studio.create.tsx`**
   - Add three picker rows above the prompt Tabs:
     - **Container**: chips (Wine bottle, Can, Laptop, Water bottle, Notebook, Other)
     - **Size**: chips (2", 3", 4", 5") with hint text ("best for cans / bottles / laptops")
     - **Shape**: chips (6 shapes) with mini silhouette swatches
   - All update the store immediately so the right-side **Live preview** reflects shape/size in real time
   - Pass container/shape/size into `generateSticker` so the AI plans composition for that surface

3. **`src/server/generate-sticker.ts`**
   - Extend input validator with optional `container`, `shape`, `size`
   - Update `buildPrompt` to inject:
     - Shape directive (e.g. *"Compose for a CIRCULAR die-cut sticker — subject fills the circular frame edge-to-edge, no empty corners"*)
     - Container directive (e.g. *"Designed to be applied to a wine bottle — proportions and detail level suited to a 3-inch label"*)
     - Size directive (e.g. *"Sized at 3 inches — keep details bold and readable at small scale"*)
   - **Remove the "transparent or solid white background" wording** from the base prompt — that's what's producing the watermark/empty-corner feel. Replace with: *"Subject fills the entire {shape} frame edge-to-edge. No empty background, no padding, no watermark, no signature, no text."*

4. **`src/routes/studio.customize.tsx`**
   - Remove the shape selector (now owned by Create)
   - Keep text layers + white border toggle
   - Add a small read-only summary chip ("Wine bottle · 3" · Circle — Change") linking back to `/studio/create`

5. **`src/routes/studio.checkout.tsx`**
   - Pre-select the size chosen in Create (read from store) instead of independent default
   - Container picker stays here only as a confirmation if needed; otherwise read-only summary

**Files touched:** `src/lib/studio-store.ts`, `src/routes/studio.create.tsx`, `src/server/generate-sticker.ts`, `src/routes/studio.customize.tsx`, `src/routes/studio.checkout.tsx`

**Out of scope:** Changing the Preview step (user explicitly said keep it as is).
