

## Goal
Change the **AI text** section in `/studio/customize` so it **regenerates the main artwork** (replacing the existing sticker image) by combining the previous image + the user's text prompt + references — instead of generating a separate transparent PNG that floats on top. This kills the checkered preview entirely (there's no transparent image anymore) and matches what the user actually wants: text *baked into* the design, consistent with the rest of the artwork.

## Diagnosis

Two issues to fix together:

1. **Checkered pattern**: It comes from the browser's default rendering of any transparent PNG — the AI text PNG `<img>` shown in the side-panel preview block (`studio.customize.tsx`, the `<img src={l.aiImageUrl} …>` near line 376) and on the sticker overlay. As long as we keep generating standalone transparent text PNGs, the user will see this.
2. **The request**: "use the extra detail shared by the user … to re-generate the image created in the previous step on Create — combining the current picture as a reference and the prompt for the new text as combined". So the model should receive the **current `imageUrl`** as an input image, plus the per-layer references, plus a prompt that says *"keep this artwork, integrate the phrase X in style Y"*. Output replaces `s.imageUrl`.

## Changes

### 1. New server function `src/server/edit-sticker-with-text.ts`
- Inputs: `{ baseImageUrl, text, prompt, references[], shape, container, volume, color? }`
- Uses `google/gemini-3-pro-image-preview` (image-edit pattern) with the base image as the first `image_url` and the references after.
- Prompt skeleton (one paragraph): *"Edit the provided sticker artwork (image 1) by integrating the exact phrase \"{text}\" into the design. Style for the lettering: {prompt}. Keep the existing composition, palette, subject matter, and overall mood unchanged — only add the lettering so it sits naturally as part of the design. Do not add unrelated elements. Honour the reference images for the assigned aspects: {role list}. Output a complete sticker matching the original aspect ratio."*

### 2. Update store
- Drop AI-text-as-overlay fields usage (we keep the type fields for backward-compat / persisted data, but stop reading them in render). 
- Add `setImageFromTextEdit(url)` that calls `setImage(url)` (already resets `imageTransform`) — or reuse `setImage` directly.
- Per-layer `aiImageUrl`, `aiWidth`, `rotation` become unused → remove their UI controls but leave the type optional for safety.

### 3. Rewrite the AI tab in `studio.customize.tsx`
The card stays a **hybrid layer** with two tabs:
- **Type text** (unchanged — overlay span)
- **AI text** — *now phrased as "Bake into artwork"*:
  - Phrase input (already there as `l.text`)
  - Style description textarea + chips (kept)
  - References uploader (kept) — roles: Font style · Color palette · Mood
  - **Generate** button → calls `editStickerWithText` with current `s.imageUrl` + the layer's text/prompt/refs → on success, calls `s.setImage(newUrl)` and **deletes this AI text layer** (since the text is now baked into the main image, the overlay is meaningless). Toast: *"Text added to your artwork."*
  - Disabled if no `s.imageUrl` yet — show helper: *"Generate the artwork on the previous step first, then come back here to bake text into it."*
  - **Remove** the floating-preview thumbnail block (line 374-378) and the Size/Rotation sliders for AI text (lines 380-405). These are what showed the checkered transparent PNG.

### 4. Cleanup in `StickerArtwork.tsx`
Remove the `if (l.mode === "ai" && l.aiImageUrl)` branch (lines 134-153). All text layers render as `<span>` overlays again. AI-text users see their text in the main `<img>`. No transparent PNG ever rendered → no checkerboard anywhere.

### 5. Persist behavior
Because `setImage` already resets `imageTransform`, the regenerated artwork shows clean and re-framable. The user can re-run AI text multiple times (each call uses the now-current image as base), iteratively layering text edits.

## Out of scope
- Server-side compositing of overlay text (we removed the overlay path entirely)
- Preserving the "type text" overlay across the regen (it remains a CSS overlay; only AI-text layers get baked in)
- Undo of the bake (user can re-run Create to start fresh)

## Why this works
- The checkered pattern disappears because no transparent PNG is rendered anywhere.
- The AI uses the *current* sticker as a true reference (image-to-image edit), so the resulting text matches the artwork's style, lighting, and palette — far better than overlaying a separately-generated typography PNG that never knew what the artwork looked like.
- Per-layer references (Font style / Color palette / Mood) still steer the lettering treatment, so the user keeps creative control.
- Iteration is natural: each "Generate" uses whatever the artwork is *now*, so users can refine in passes.

