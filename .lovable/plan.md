

## Goal
Expand the **Type text** font picker on `/studio/customize` with a much larger curated font library (Google Fonts) and let users **upload their own font files** (.ttf/.otf/.woff/.woff2) for use on any text layer.

## Design

### 1. Curated Google Fonts library (~30 fonts)
Replace the 6-font hardcoded list in `studio-store.ts` with categorized options:
- **Sans**: Inter, Poppins, Montserrat, Raleway, Work Sans, Nunito, Bebas Neue, Oswald
- **Serif**: Playfair Display, Merriweather, Lora, Cormorant Garamond, EB Garamond, DM Serif Display, Crimson Text
- **Script / Handwritten**: Dancing Script, Great Vibes, Pacifico, Caveat, Sacramento, Allura, Parisienne
- **Display**: Abril Fatface, Lobster, Bungee, Anton, Righteous, Fredoka, Permanent Marker
- **Mono**: JetBrains Mono, Courier Prime

Each entry: `{ family, category, googleParam? }`. Loaded on demand: when a font is picked (or rendered) we inject `<link href="https://fonts.googleapis.com/css2?family=...&display=swap">` once into `<head>`.

### 2. Custom font upload
Add a small "Upload font" button next to the font dropdown.
- Accepts `.ttf, .otf, .woff, .woff2` (max 2MB).
- File → `FileReader.readAsDataURL` → store as `{ id, name, dataUrl, format }` in the studio store under a new `customFonts: CustomFont[]` array (persisted via existing zustand `persist`).
- On load (and on every page mount), iterate `customFonts` and inject a `@font-face { font-family: 'user-<id>'; src: url(<dataUrl>) format('<format>'); }` rule into a single managed `<style id="studio-custom-fonts">` block.
- Custom fonts appear in the dropdown under a "Your fonts" group, labelled with the original filename.

### 3. Font picker UI (`studio.customize.tsx`)
Replace the plain `<Select>` with a grouped `<Select>`:
```
Your fonts
  └ wedding-script.ttf
Sans
  └ Inter, Poppins, Montserrat, …
Serif
  └ Playfair Display, …
Script
  └ Dancing Script, …
Display / Mono
```
Each option's label is rendered in its own font for live preview. Below the select: `[ Upload font ]` button + tiny helper "TTF/OTF/WOFF up to 2MB".

### 4. Font loading helper (`src/lib/fonts.ts`, new)
- `ensureGoogleFont(family)` — idempotent `<link>` injection keyed by family.
- `injectCustomFonts(customFonts)` — rebuilds the `<style id="studio-custom-fonts">` content.
- Called from `StickerArtwork.tsx` (so fonts load wherever the sticker is rendered: customize, preview, checkout) and from the font picker on hover/select.

### 5. Store changes (`src/lib/studio-store.ts`)
- Replace `FONT_CHOICES` string array with `FONT_LIBRARY: FontEntry[]` plus a helper `getFontFamilyCSS(value)` that returns the actual CSS `font-family` (handles `user-<id>` prefix for custom fonts).
- Add `customFonts: CustomFont[]`, `addCustomFont(file)`, `removeCustomFont(id)`. Persist `customFonts` via `partialize`.
- `TextLayer.font` continues to store a string — either a Google family name or `user-<id>`.

## Out of scope
- Server-side font hosting (custom fonts live in localStorage only — they survive refresh per device but aren't shared across devices).
- Baking custom fonts into the AI "bake into artwork" path (the AI generator works from prompts/references, not literal font files; we keep that flow unchanged).
- Variable-font axis controls.

## Why this works
Users get a real type library instead of 6 system fonts, plus a true escape hatch for brand or wedding-specific fonts via upload — all without a backend. Loading is on-demand so the page stays fast, and because fonts persist in the existing zustand store they're available across every studio step.

