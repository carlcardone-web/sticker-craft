
## What templates should do

Treat each template as a **starter recipe** that pre-fills the Create form so the user can tweak instead of starting from a blank prompt. Clicking a template should:

1. **Seed the prompt** with a real, editable description (e.g. "A botanical wreath of eucalyptus leaves and small white flowers framing a monogram, soft watercolor on cream").
2. **Apply a matching style preset** (one of `STYLE_PRESETS` — watercolor, minimal, etc.).
3. **Suggest a shape** appropriate for the occasion (e.g. monogram → circle, balloons → square).
4. **NOT** generate or set a fake image. The user still hits **Generate** to produce the real artwork. The colored gradient on the tile becomes purely a visual mood hint, not the output.

After clicking, the page scrolls/switches to the Describe tab so the user immediately sees the seeded prompt and can edit it before generating.

## Changes

### 1. Expand the `TEMPLATES` data (`src/routes/studio.create.tsx`)
Each entry gains:
- `prompt: string` — the seeded description
- `styleId: string` — id from `STYLE_PRESETS`
- `shape: StickerShape` — suggested shape

### 2. Rewrite the click handler
Replace the SVG-data-URL hack with:
```ts
setPrompt(t.prompt);
setStylePreset(t.styleId);
setShape(t.shape);
setActiveTab("describe");   // jump back so they see what was filled in
toast.success(`Loaded "${t.title}" — tweak it and hit Generate`);
```
Convert the `Tabs` to controlled mode (`value` + `onValueChange`) so we can switch programmatically.

### 3. Clarify the UI
- Rename the tab from **Templates** to **Starter ideas**.
- Add a one-line helper above the grid: *"Pick one to pre-fill the prompt and style — you can edit everything before generating."*
- On each tile, show a small "Use this" affordance on hover so the action is obvious.
- Keep the gradient as ambient mood color (no longer pretending to be the output).

### 4. Optional polish (low effort)
Add a tiny chip on each tile showing the suggested style (e.g. "Watercolor") so users understand what they're loading.

## Out of scope
- Real template thumbnails (would need pre-generated AI art per template — flag as a follow-up if you want).
- Saving custom templates.
- Per-occasion filtering of the grid.

## Why this works
Templates stop lying about being finished art and become what users actually expect: jumping-off points that fill in the form. The gradient tile is honest mood-board decoration, the Describe tab now shows real seeded text the user can refine, and the path to generation stays the same — no new mental model.
