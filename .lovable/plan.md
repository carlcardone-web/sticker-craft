
User wants to drop Replicate entirely and just use Lovable AI (Gemini image models). Simplifies the plan a lot.

## Plan: Wire up real AI image generation via Lovable AI

### Backend
Create **`supabase/functions/generate-sticker/index.ts`** (TanStack project but we already have `client.server.ts` etc; checking config.toml — it's a Supabase edge function project given `supabase/config.toml` exists). Use Supabase edge function:
- CORS headers
- Reads `LOVABLE_API_KEY` (already in secrets)
- Accepts `{ prompt, stylePreset, quality }`
- Builds sticker-optimized prompt: appends style preset language + "die-cut sticker style, clean background, centered composition, no text"
- Calls `https://ai.gateway.lovable.dev/v1/chat/completions` with `modalities: ["image", "text"]`
- Model: `google/gemini-2.5-flash-image` (fast, default) or `google/gemini-3-pro-image-preview` (high quality)
- Returns `{ imageUrl }` (base64 data URL from response)
- Handles 429 → friendly "rate limited" message; 402 → "add credits" message

Add function block to `supabase/config.toml` with `verify_jwt = false`.

### Client

**`src/lib/studio-store.ts`** — add `quality: "fast" | "high"` (default `"fast"`) + `setQuality` setter.

**`src/routes/studio.create.tsx`** — replace placeholder generator:
- Replace SVG placeholder in `handleGenerate()` with `supabase.functions.invoke('generate-sticker', { body: { prompt, stylePreset, quality } })`
- Add a small "Quality" segmented toggle (Fast / High) below the style presets — subtle, sage-themed
- On error: show toast (sonner is available) with friendly message for 429/402
- Keep the existing "Designing your sticker…" loader copy
- Templates tab and Upload tab keep current behavior for this turn (upload uses raw image; templates use placeholder SVG) — out of scope

### Out of scope this turn
- Image edit/style-transfer for Upload tab (would need a follow-up)
- Background removal as separate step (prompt instructs the model directly)
- Caching to Supabase Storage
- Replicate provider (dropped per user)

### Files
- create `supabase/functions/generate-sticker/index.ts`
- edit `supabase/config.toml` (add function config)
- edit `src/lib/studio-store.ts` (add quality state)
- edit `src/routes/studio.create.tsx` (call edge function, add quality toggle, error toasts)
