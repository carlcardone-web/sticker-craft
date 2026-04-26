## Simplify the Text layers panel into a single AI-driven prompt

### Goal
Get rid of the "Type text / AI text" segmented toggle and the "Bake text into artwork" flow. Replace them with a single textarea where the user describes the text they want — content + style hints together. The base sticker is never re-baked. The text layer is always rendered client-side as an overlay using the existing font, color, size, and position controls.

### New behavior

In each text layer card:

- **Remove** the `Tabs` (Type text / AI text) at the top of the card.
- **Remove** the "Bake text into artwork" button and the entire AI-bake branch.
- **Remove** the references grid (font-style reference uploads) inside the layer card — those were AI-bake inputs.
- **Remove** the standalone `Input` for "The phrase to render".
- **Add** a single `Textarea` labeled "Describe the text" with placeholder:
  `e.g. "Sarah & Tom" in elegant gold script along the top`
- **Keep** below it, in this order: font picker + font upload, color picker, size slider, horizontal slider, vertical slider.
- **Keep** the trash button to remove the layer.

Also in the panel header (`TextLayerEditor`):
- **Rename** the empty-state copy from "type them live or bake them into the artwork with AI" to something like "Describe what you want and we'll style it onto the sticker."
- **Remove** mention of "+ Add text overlay" wording on the collapsible trigger — relabel to "Text layers (optional)" so it isn't framed as an overlay-add action. The collapsible itself stays.

### Resolve prompt → final string + style

When the user edits the prompt or blurs it (debounced ~600ms), call a small server function that:

1. Takes the freeform description.
2. Returns `{ text: string, suggestedFont?: string, suggestedColor?: string, suggestedPosition?: "top"|"middle"|"bottom" }`.
3. **Quoted-text rule**: if the description contains text in straight or smart quotes, use that verbatim as `text` and skip AI rewriting for the content (still allow style suggestions).

The returned `text` is written into `layer.text`. Suggested style fields are applied **only the first time** for that layer (so the user's later manual edits to font/color/position are not overwritten on every keystroke). Track this with a per-layer `styleApplied` flag in local state inside `TextLayerCard` — no store changes required for that flag.

The text overlay continues to render client-side via the existing `StickerArtwork` text rendering path using `layer.text`, `layer.font`, `layer.color`, `layer.size`, `layer.x`, `layer.y`. No image regeneration. No call to `editStickerWithText`.

### Server function

Add `src/server/resolve-text-layer.ts`:

- `createServerFn({ method: "POST" })` guarded by `requireSupabaseAuth`.
- Input: `{ description: string }` (max ~400 chars).
- Uses Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) with a fast text model (`google/gemini-2.5-flash-lite`) and JSON output, system prompt instructing it to:
  - Extract the literal phrase the user wants (respect quoted text verbatim, otherwise propose a short phrase).
  - Suggest font family from a small allowed list (matching `FONT_LIBRARY` categories, e.g. "Playfair Display", "Inter", "Caveat", "Bebas Neue", "Lora").
  - Suggest a hex color.
  - Suggest a position bucket: `top` / `middle` / `bottom`.
- Returns the parsed JSON. Handles 429/402 like existing functions.

Map `suggestedPosition` → `y` in the client (top≈18, middle≈50, bottom≈82).

### Files to update

- `src/routes/studio.create.tsx`
  - Rewrite `TextLayerCard` per above (drop Tabs, references, bake button; add description Textarea + debounced resolver call; keep font/color/size/x/y).
  - Update `TextLayerEditor` empty-state copy.
  - Update the surrounding Collapsible label ("+ Add text overlay" → "Text layers (optional)").
  - Remove now-unused imports (`Tabs*`, `editStickerWithText`, `ImagePlus`, `STYLE_CHIPS`, `TEXT_REF_ROLES`, `Sparkles` if only used here, etc.).
- `src/server/resolve-text-layer.ts` (new) — described above.
- `src/lib/studio-store.ts` — no schema change needed; `mode`, `aiPrompt`, `aiReferences`, `aiImageUrl`, `aiWidth` become unused at the UI level but stay in the type for backward-compatible persistence. (No migration needed.)

Out of scope:
- Backend image generation, prompt builder, container flow, top bar — unchanged.
- The `editStickerWithText` server function stays in the codebase but is no longer called from the studio page.

### Acceptance

- The Text layers panel shows a single textarea per layer, no segmented control, no bake button, no reference uploads.
- Typing a description (or pasting `"Sarah & Tom" in gold script at the top`) populates the layer text and applies a sensible font/color/position once, then leaves manual tweaks alone.
- The sticker preview updates immediately via the existing client-side overlay; no new image generation request is fired.
- Font picker, font upload, color, size, horizontal, vertical sliders all still work and are visible below the prompt.
