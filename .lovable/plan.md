
## Restructure `/studio/create` around a preview-first hierarchy

### What will change
Rebuild the Create page so the visual preview becomes the primary focal point on the left, while all controls move into one clean, stacked right column with progressive disclosure for advanced options and text overlays.

### Files to update
- `src/routes/studio.create.tsx`
- `src/components/studio/StickerArtwork.tsx`
- `src/routes/studio.preview.tsx` (only if needed to share mockup/container preview helpers cleanly)
- `src/lib/studio-store.ts` (only if a tiny UI state addition is needed for panel persistence)

## Implementation plan

### 1) Recompose the page layout in `src/routes/studio.create.tsx`
- Keep the existing top bar exactly as-is.
- Keep the same page heading text, but simplify the subtitle to:
  - `Describe it. Preview it. Refine it.`
- Replace the current `lg:grid-cols-[minmax(0,1fr)_380px]` structure with a true preview-first 2-column layout:
  - left column: sticky preview hero, about 40%
  - right column: single control rail, about 60%
- Remove the current right-panel “Customization” heading and the duplicated visual emphasis around controls.

### 2) Make the left column the sticky visual hero
Build a dedicated preview card with:
- small uppercase `LIVE PREVIEW` label
- large centered preview area
- caption below with dimensions + scale context
- sticky behavior on desktop
- collapsible behavior on mobile

Behavior:
- Before generation: show the existing placeholder copy, but match requested wording:
  - `Your label appears here`
- After generation: show the current artwork composited in context
- Preserve live client-side updates for:
  - shape
  - white border
  - text overlays
  - existing image transform/framing adjustments if kept visible

### 3) Put the sticker on the selected container mockup directly in the Create preview
The Create page currently uses `StickerArtwork` alone, while `/studio/preview` already has container mockups. Reuse that pattern so the left preview shows the sticker rendered on the selected bottle/can directly on this page.

Implementation approach:
- extract or reuse the container/mockup mapping currently living in `src/routes/studio.preview.tsx`
- render the selected mockup inside the Create preview card
- overlay `StickerArtwork` at the correct position/size for the active container
- keep the dimensions caption underneath, e.g. `8 × 10 cm · shown to scale on wine bottle`

### 4) Rebuild the right column as one focused stack of control sections
Order the controls exactly as requested:

#### A. Prompt card
Use one main card with 3 tabs:
- `Describe it`
- `Upload`
- `Templates`

Behavior:
- `Describe it`:
  - keep `MentionTextarea`
  - preserve current 300-char cap and counter
  - move counter inside/bottom-right visual treatment
  - preserve preset chips below the textarea
- `Upload`:
  - show the existing reference image upload UI only in this tab
- `Templates`:
  - show the existing template grid only in this tab

This keeps existing store/state intact while improving hierarchy.

#### B. Shape selector card
- Keep the existing 6 shapes
- Render as equal-width square tiles in one horizontal row/grid
- Show icon + label
- Use subtle default border and stronger selected border/text state
- Remove any redundant shape UI elsewhere on the page

#### C. Advanced controls
Convert the current always-open slider stack into one collapsible section:
- trigger row label: `Advanced: realism, color, seed`
- right chevron rotates on open
- collapsed by default
- smooth open/close transition

Inside expanded content:
- realism slider
- hue slider with rainbow track
- swatch + named color
- saturation slider
- lightness slider
- color influence slider
- lock seed toggle
- current seed display

Use subtle dividers and spacing instead of separate nested cards.

#### D. Text layers
Convert the current text layer editor into a second collapsible section:
- closed by default
- trigger row: `+ Add text overlay`
- right-side hint: `optional`

Expanded state:
- reuse existing text layer editor UI and state
- keep up to 2 text layers
- preserve current editable overlay behavior
- do not bake regular typed text into the AI prompt

#### E. White die-cut border row
Keep this visible outside collapsibles:
- simple label left
- switch right

#### F. Primary CTA area
Refactor CTA logic:
- primary full-width dark button: `Generate sticker`
- disabled when prompt is empty
- loading label: `Designing your sticker…`
- after first generation, show a regenerate action beside or near the primary CTA using the existing refresh behavior
- only show `Continue →` after at least one successful generation
- `Continue` becomes secondary/outline/ghost and sits below generate actions

Remove the current always-visible dual-primary CTA pattern.

### 5) Adjust mobile behavior
For widths under `md`/`768px`:
- stack layout vertically
- preview appears first
- preview card can collapse/expand
- cap preview height around 300px
- keep the main generate button sticky at viewport bottom
- keep control sections below the preview for easier reach

### 6) Preserve existing logic while changing presentation only
Out of scope remains unchanged:
- no backend/API contract changes
- no container-selection flow changes
- no top bar behavior changes
- no prompt builder / seed logic changes

Existing behaviors to preserve:
- current generate/regenerate handlers
- current moderation and deterministic prompt flow
- current slider values and state
- current text layer store/actions
- current white border behavior
- current preview routing to `/studio/preview`

### 7) Small supporting refactors
If needed:
- add local UI state for:
  - active top tab
  - advanced panel open/closed
  - text overlay panel open/closed
  - mobile preview expanded/collapsed
- if persistence is required “during session,” store panel open state in session-safe client state or lightweight persisted store fields
- if preview composition code becomes duplicated, extract a small shared helper/component for:
  - container mockup lookup
  - sticker overlay positioning
  - label dimension caption formatting

### 8) `StickerArtwork` polish for the new preview context
Update only if necessary for the new Create-page hero preview:
- ensure placeholder treatment looks intentional inside a larger mockup scene
- keep text overlays rendering on top of the artwork
- preserve white border and shape silhouette
- avoid altering underlying generation behavior

### 9) Acceptance target
The refactor is complete when:
- the Create page clearly leads with the preview on the left
- the right side reads as one guided control flow
- advanced realism/color/seed controls are collapsed by default
- text overlay UI is hidden until expanded
- `Continue` is hidden until generation exists
- the preview updates client-side for shape, text overlays, white border, and framing changes
- mobile stacks cleanly with a compact preview and reachable controls
- all existing generation/state logic still works without backend changes
