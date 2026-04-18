
## Goal
Turn the **Text layers** panel on `/studio/customize` into an AI-assisted text studio: instead of typing flat text and picking from a dropdown of system fonts, the user can describe a style ("hand-painted gold script for a wedding"), optionally attach references (font sample, color palette, mood), and get an **AI-generated text image** that drops onto the sticker as a draggable, scalable, framable layer — exactly like the artwork already works.

## Design

Each text layer becomes a **hybrid layer**: it can either be a normal text node (current behaviour, preserved) or an **AI text image** (new). User picks per-layer.

```
Text layer card
├─ Mode toggle:  [ Type text ]  [ AI text ]
├─ If "Type text"  → existing text/font/color/size controls
└─ If "AI text"
   ├─ Prompt: "Sarah & Tom in flowing gold calligraphy"
   ├─ Content text (what the rendered word(s) should say)
   ├─ Style chips: Calligraphy · Bold serif · Hand-painted · Vintage · Neon · Gold foil
   ├─ Reference photos (up to 2 per layer): Font style · Color palette · Mood
   ├─ [Generate]  →  returns transparent PNG
   ├─ Position (x/y), Size (scale), Rotation sliders
   └─ Preview thumbnail + Regenerate
```

The AI-rendered text is stored as an image URL on the layer and rendered as an `<img>` overlay inside `StickerArtwork.tsx`, so it auto-shows on Customize, Preview, and Checkout (just like the main artwork). User drags/sizes it via sliders.

## Changes

### 1. Store (`src/lib/studio-store.ts`)
Extend `TextLayer`:
```ts
type TextLayer = {
  id: string;
  mode: "text" | "ai";              // NEW
  text: string;                      // used for mode="text" + as the word the AI should render
  font: string; color: string; size: number;
  x: number; y: number;
  // AI mode fields:
  aiPrompt?: string;                 // style description
  aiImageUrl?: string;               // generated transparent PNG
  aiReferences?: ReferenceImage[];   // per-layer refs (max 2)
  aiWidth?: number;                  // % of sticker width (default 60)
  rotation?: number;                 // degrees (-180..180), default 0
};
```
Default new layers to `mode: "text"` for backwards compatibility. Add actions: `setTextLayerAiImage(id, url)`, `addTextLayerReference(id, url, role)`, `updateTextLayerReference(id, refId, role)`, `removeTextLayerReference(id, refId)`.

Persist these new fields automatically (already covered by `partialize` of `textLayers`).

### 2. New server function (`src/server/generate-text-art.ts`)
Mirror of `generate-sticker.ts`, scoped to text:
- Accepts `{ text, prompt, references, color? }`
- Builds a prompt forcing **transparent background, single phrase rendered as decorative typography**, no extra elements
- Calls the same `google/gemini-3-pro-image-preview` model with `modalities: ["image", "text"]`
- Returns `{ imageUrl }`

Prompt skeleton:
> "Render the exact phrase \"{text}\" as decorative typography in the following style: {prompt}. Transparent background, no frame, no decoration outside the letters, crisp edges. Apply references for: {role list}."

### 3. `StickerArtwork.tsx` rendering
For each `TextLayer`:
- If `mode === "ai" && aiImageUrl`: render `<img>` positioned at `(x,y)`, sized to `aiWidth%` of the sticker width, rotated by `rotation`, `pointer-events:none`, `object-contain`.
- Else: existing `<span>` text rendering.

### 4. Customize page UI (`src/routes/studio.customize.tsx`)
Rewrite the text-layer card:
- Mode toggle (Tabs/Segmented control)
- "Type text" tab → keep current controls untouched
- "AI text" tab → 
  - `Input` for the **content** (the phrase to render — defaults to existing `text`)
  - `Textarea` for **style description**
  - Quick style chips that append to the prompt
  - Compact reference uploader (reuses the same data-URL upload pattern as Create) with role picker (Font style / Color palette / Mood)
  - **Generate** button → calls `generateTextArt` → stores `aiImageUrl`
  - When `aiImageUrl` exists: show preview thumbnail + sliders for **Size** (`aiWidth`, 20-100%), **Rotation** (-45° to 45°), **Horizontal/Vertical position** (already exists)
  - **Regenerate** button

Keep the per-layer **Position** sliders shared between both modes so framing UX is consistent.

### 5. Wiring
- `customize.tsx` already passes `textLayers` to `StickerArtwork` — no change needed for downstream rendering.
- `preview.tsx` and `checkout.tsx` already pass `textLayers` through — they'll pick up AI text automatically.
- Reset on "Start over" — already covered by `reset()`.

## Out of scope
- Animating text or live font preview before generation
- Baking text images into the final exported PNG server-side (still composited via CSS at preview/checkout — same approach as artwork framing)
- Sharing the create-page reference photos with text layers (kept separate so font/color refs don't pollute the main artwork)

## Why this works
The hybrid model preserves the simple "type and pick a font" path for users who want speed, while giving creative users an AI text generator that respects the same patterns they already know: prompt + references + roles + drag-to-position. Because the output is just an image layer, all existing scale/position/persistence plumbing applies — no new rendering pipeline, no checkout-flow changes.
