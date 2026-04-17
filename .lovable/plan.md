
## Changes to `src/routes/studio.create.tsx` and `StickerArtwork.tsx`

### 1. Fix Circle shape rendering (`StickerArtwork.tsx`)
Currently both `circle` and `oval` map to `borderRadius: 50%`, so they look identical when the underlying frame is rectangular (because aspect ratio comes from label dimensions). 

Fix: When `shape === "circle"`, force the frame to be a **true square** (1:1) using the smaller of the two computed dimensions as the diameter — this overrides the label's natural aspect ratio so the circle has equal diameter across every point. Oval keeps the label's aspect ratio + 50% radius (becomes a true ellipse).

### 2. Remove "Upload & style" tab (`studio.create.tsx`)
- Remove the `<TabsTrigger value="upload">` and the entire `<TabsContent value="upload">` block (lines ~190-192 and ~318-340).
- Remove the now-unused `Upload` icon import and the `onUpload` function.
- Rationale: users already have the "Reference photos" uploader inside the Describe tab, which covers the same use case.

### 3. Click live preview to edit
Make the `StickerArtwork` in the right-hand "Live preview" panel clickable. Clicking navigates to `/studio/customize` (the editing step) — but only when `imageUrl` exists.

Implementation: wrap the `StickerArtwork` in a `<button>` (or div with role="button") that calls `navigate({ to: "/studio/customize" })`. Add a subtle hover hint ("Click to edit") via overlay tooltip, and keep the existing "Continue" button below for clarity. If no image yet, the click is disabled.

### Out of scope
- Changing customize-page editing UX
- Removing the Templates tab
- Touching server prompt logic
