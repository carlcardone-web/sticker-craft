
## Refactor the sticker generation flow for deterministic, reproducible output

### 1) Add a pure deterministic prompt module
Create `src/lib/prompt-builder.ts` as the single source of truth for prompt assembly.

What it will contain:
- The provided `buildPrompt(input)` implementation
- `normalizeForModeration(text)`
- Supporting exports needed by the UI:
  - `NAMED_COLORS`
  - `nearestNamedColor(...)`
  - the prompt input/output types

Behavior:
- Prompt parts will always be assembled in the same canonical order
- Identical inputs will always produce identical `prompt` and `negativePrompt`
- Shape/container composition text will live only here to avoid duplication elsewhere

### 2) Extend studio state for reproducible generation
Refactor `src/lib/studio-store.ts` to support the new structured inputs and generation history.

Add to state:
- New slider fields:
  - `realism`
  - `hue`
  - `saturation`
  - `lightness`
  - `colorInfluence`
- Per-slider “dirty” tracking so preset defaults only apply until the user manually changes them
- Reference image weight on `ReferenceImage`
- `lastGeneration`:
  - `prompt`
  - `negativePrompt`
  - `seed`
  - `params`
- Seed controls:
  - `lockSeed`
  - current `seed`

Update existing data:
- Extend each entry in `STYLE_PRESETS` with:
  - `promptFragment`
  - `negativeFragment`
  - optional default slider values
- Add store actions for:
  - updating sliders
  - marking sliders dirty
  - updating reference image weight
  - persisting `lastGeneration`
  - toggling seed lock
  - generating/reusing seeds
- Update `STEPS` to reflect the merged flow

### 3) Move generation request shape from “raw fields” to “resolved prompt”
Refactor the create flow so the client computes the final deterministic prompt before calling the server.

Changes in `src/routes/studio.create.tsx`:
- Replace the current raw `generateSticker({ prompt, stylePreset, container, shape, volume... })` call
- Build a structured payload from store state
- Call `buildPrompt(...)`
- Send:
  - `prompt`
  - `negativePrompt`
  - `seed`
  - `referenceImages`

Changes in `src/server/generate-sticker.ts`:
- Remove the local ad-hoc prompt builder
- Accept the new input contract:
  - `prompt`
  - `negativePrompt`
  - `seed?`
  - `referenceImages`
- Validate and forward `negativePrompt` and `seed` to the image model request
- Keep auth and artwork persistence intact

### 4) Merge “Customize” into “Create your sticker”
Unify the current `/studio/create` and `/studio/customize` responsibilities into a single creation screen.

`src/routes/studio.create.tsx` will become the one primary editor containing:
- prompt textarea
- reference images
- style preset chips
- shape picker
- all five new sliders
- generate controls
- existing live preview

Layout:
- Desktop: two columns
  - left: prompt, templates, references, shape, style
  - right: sticky customization card with sliders, seed controls, preview, generate/regenerate buttons
- Mobile: vertical stack

Compatibility:
- Keep `src/routes/studio.customize.tsx`, but convert it into a redirect/compatibility route back to `/studio/create` so old links do not break
- Update preview/back buttons and step navigation to point to the merged create page

### 5) Add the five sliders with live deterministic color feedback
Implement the new controls in the merged create screen using the existing shadcn slider.

Sliders:
- Realism (0–100)
- Color hue (0–360)
- Color saturation (0–100)
- Color lightness (0–100)
- Color influence (0–100)

UI details:
- Each control gets:
  - label
  - tooltip
  - live numeric/value readout
- Hue slider gets:
  - rainbow-style track
  - live HSL swatch
  - resolved named-color label using `nearestNamedColor(h, s, l)`
  - label updates whenever hue, saturation, or lightness changes
- Realism and color influence show endpoint captions:
  - `Cartoon / Illustrated` → `Photorealistic`
  - `Subtle hint` → `Dominant`

Preset behavior:
- When a user selects a preset, apply preset slider defaults only for sliders the user has not manually touched yet

### 6) Add seed locking and reproducibility controls
In the merged create screen:
- Add a `Lock seed` toggle
- Add `Regenerate with same seed` beside the existing regenerate action

Behavior:
- If seed is unlocked, generate a new seed when creating a fresh variation
- If locked, reuse the existing seed
- After every successful generation, persist `lastGeneration = { prompt, negativePrompt, seed, params }`

Debug UI:
- Add a small collapsible `Debug` panel below the preview
- Gate it behind `import.meta.env.DEV`
- Show:
  - seed
  - resolved prompt
  - negative prompt
  - resolved color name
  - structured params summary

### 7) Soft-cap the prompt textarea at 300 chars
Refine the prompt input in `src/routes/studio.create.tsx` and keep `MentionTextarea` compatible.

Behavior:
- Live character counter
- Warning state after 250 chars
- Hard block past 300 chars
- Preserve mention insertion behavior without allowing overflow

Moderation:
- Replace current moderation with:
  - `normalizeForModeration(text)`
  - then blocklist matching on normalized text

### 8) Add reference-image weights and role-labeled instructions
Extend the reference image model and UI.

State changes:
- `ReferenceImage` gains `weight?: number`

UI changes:
- Each reference card gets:
  - existing role input
  - new weight slider (0.2–1.0, default 0.7)
  - visible strength label if helpful (`light`, `guided`, `strong`)

Prompt behavior:
- `buildPrompt` consumes both role and weight via `referenceInstructions(...)`

### 9) Remove duplicated composition logic from the old flow
Clean up the prompt pipeline so shape/container instructions are not appended in multiple places.

Specifically:
- Eliminate the old `STYLE_HINTS`, `SHAPE_HINTS`, `CONTAINER_HINTS`, dimension/conflict composition assembly from `src/server/generate-sticker.ts`
- Keep only one prompt composition system in `src/lib/prompt-builder.ts`

### 10) Fix shape icons and polish create-page semantics
Update shape icon mapping in the create UI:
- Replace oval’s duplicate circle icon with a more oval-looking icon or custom SVG
- Give die-cut and rounded distinct icons

Also:
- Ensure the create page has exactly one creation section for prompt + refs + style + shape + sliders + generate
- Preserve existing preview functionality and routing flow to preview/checkout

### 11) Files to update
Primary files:
- `src/lib/prompt-builder.ts` (new)
- `src/lib/studio-store.ts`
- `src/routes/studio.create.tsx`
- `src/server/generate-sticker.ts`
- `src/routes/studio.customize.tsx`
- `src/routes/studio.preview.tsx`
- `src/components/studio/StepIndicator.tsx` or any step consumers affected by merged flow
- `src/components/studio/MentionTextarea.tsx` if needed for capped input behavior

### 12) Acceptance targets after implementation
The refactor will be considered complete when:
- `buildPrompt(...)` is pure and deterministic
- the Create page is the single unified editing surface
- the named-color label updates live from HSL changes
- preset defaults populate untouched sliders only
- locked-seed regeneration reuses the same seed and preserves reproducibility
- reference roles and weights affect the final prompt deterministically
- moderation works on normalized text
- composition text is generated only once, from `buildPrompt`
