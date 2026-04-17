
Combine both requirements into one edit of `src/server/generate-sticker.ts`. The "no transparent background" rule overrides Claude's "white or transparent background only" clause.

**Single file: `src/server/generate-sticker.ts`**

1. **Expand `CONTAINER_HINTS`** — rewrite each beverage entry with spatial geometry + label aesthetics:
   - wine: central motif, ornamental framing, cream/off-white palette, premium wine-label feel
   - beer: bold characterful design, readable on curved brown/green glass
   - champagne: celebratory, gold/cream/black palette, refined neck-label proportions
   - spirits: premium high-contrast, distinctive whiskey/gin/vodka label feel
   - can: cylindrical wrap, bold high-contrast, no fine detail (lost on curves)
   - growler: artisanal craft feel, bold readable design for large vessel

2. **Expand `STYLE_HINTS`** — 20–25 words each covering texture, line quality, palette, technique (watercolor, lineart, vintage, flat, photographic, cartoon).

3. **Add `ASPECT_HINTS`** dict per container (wine 2:3 portrait, beer 3:2, champagne ~1:1.2, spirits 2:3, can 3:1 panoramic, growler 4:2). Inject into prompt.

4. **Sharpen reference notes** — single ref: *"extract only the {role} (e.g. colour palette, subject shape, brushwork style) from this image — do not copy literally."* Multi-ref version analogous.

5. **Restructure `buildPrompt` order**:
   - **Prefix (STRICT RULES)**: *"STRICT RULES: pure illustration only. No text, no words, no letters, no numbers, no watermark, no logo, no signature, no UI elements. NO transparent background, NO empty background, NO negative space, NO white padding."*
   - User prompt
   - Style hint
   - Shape hint
   - Container hint + aspect hint
   - Size hint
   - Conflict-resolution sentence (when both container and shape present): *"This artwork will be applied as a {container} label cut to a {shape} shape. Prioritise the {shape} frame fill, but reflect the {container} label aesthetic in colour, motif, and mood."*
   - Reference note
   - Edge-to-edge fill instruction (kept)
   - **Final render clause** (overrides Claude's transparent allowance): *"Render as a print-quality illustration with crisp edges. The artwork must completely fill the {shape} frame with solid, fully-painted imagery — every pixel inside the frame is part of the illustration. No transparent areas."*

**Unchanged:** validator, model, fetch logic, error handling, exports, UI, store, routes.
