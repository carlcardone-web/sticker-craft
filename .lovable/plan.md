
## Goal
Add an `@` mention system in the prompt textarea on `/studio/create`. Typing `@` opens a popover listing the user's reference photos (already uploaded with roles like "subject", "color palette", "background"). Selecting one inserts a styled token like `@subject` into the prompt, which the AI then resolves to the corresponding image.

## Current state
- `studio.create.tsx` already has a "Reference photos" uploader (up to 3) where each photo gets a role label (e.g. "subject", "background", "color palette").
- The prompt textarea is a plain `<Textarea>`.
- `generateSticker` server fn already receives `referenceImages: [{ url, role }]` and builds a generic "image 1 = subject, image 2 = background…" instruction.

## Changes

### 1. `src/routes/studio.create.tsx` — add @-mention picker
- Wrap the prompt `<Textarea>` in a relative container with a floating popover.
- Track caret position; when the user types `@`, open a small popover anchored near the caret listing the currently uploaded reference photos. Each row shows a thumbnail + role label (e.g. "🖼️ subject", "🎨 color palette", "🌄 background"). If no refs uploaded, show a hint: *"Upload a reference photo below to mention it."*
- Filter the list as the user keeps typing characters after `@` (e.g. `@sub` → only "subject").
- Selecting an item replaces the in-progress `@xxx` with `@<role>` (sluggified, e.g. `@color-palette`) followed by a space. Arrow keys + Enter to pick, Esc to close.
- Render mentions visually inside the textarea using a lightweight overlay (a mirrored `<div>` behind the textarea that highlights `@token` substrings in the brand color). Standard trick: textarea stays the editable surface, overlay is `pointer-events: none` and scrolls in sync.

### 2. `src/server/generate-sticker.ts` — resolve mentions in the prompt
- Before building the final prompt, scan `data.prompt` for `@<role>` tokens and, for each one that matches a `referenceImages[i].role` (case-insensitive, hyphen-insensitive), append a stronger directive: *"Where the prompt says `@subject`, use reference image N (role: subject) as the literal subject of the sticker."*
- Keep the existing role-extraction note as fallback for unreferenced images.
- No schema/DB changes.

### 3. Small UX polish
- Add a one-line helper under the textarea: *"Tip: type `@` to reference an uploaded photo (e.g. `@subject`, `@background`)."*
- Keep the existing reference-photo uploader exactly as-is — it's the source of truth for what `@` can mention.

## Out of scope
- Mentioning anything other than uploaded reference photos (no @style, @shape, etc.)
- Rich-text/contenteditable editor (keeping plain textarea + overlay for reliability)
- Persisting mentions across sessions

## Why this works
The roles the user already assigns to reference photos become first-class tokens in the prompt. The picker eliminates guesswork ("what did I call that photo?"), and the server-side resolver turns `@subject` into an explicit, image-bound instruction — much stronger than the current generic "image 1 = subject" hint, which the model sometimes ignores.
