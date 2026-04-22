
## Fix the repeated `upstream request timeout` during sticker generation

### What’s happening
The failure is not coming from your prompt builder or auth layer. The request is reaching `src/server/generate-sticker.ts`, which then waits synchronously for the AI image API to finish. The preview network logs show a `504` with body `upstream request timeout`, which means the upstream image-generation call is taking longer than the server-function request window allows.

Two things in the current code make that much more likely:
- `src/server/generate-sticker.ts` uses the slower high-quality model `google/gemini-3-pro-image-preview`
- the request is sending full base64 `data:` URLs for reference images, and the captured request body contains a very large inline JPEG payload

So this is primarily a latency/payload-size problem, not a bad prompt or broken button.

## Implementation plan

### 1) Harden the generation server function for timeout-prone AI calls
Update `src/server/generate-sticker.ts` to make slow upstream behavior explicit and more resilient:
- detect timeout-like upstream responses and return a clearer user-facing error than the generic “Image generation failed”
- log request characteristics that matter for debugging:
  - model used
  - prompt length
  - reference count
  - total reference payload size
  - whether refs are `data:` URLs or hosted URLs
- keep seed normalization and existing auth intact

Expected result:
- users see a meaningful message like “Generation took too long — try again with fewer/smaller references”
- future debugging becomes straightforward

### 2) Reduce request size before the AI call
Refactor the reference-image path so the server is not forwarding giant inline base64 blobs whenever possible.

Preferred change:
- upload reference images to backend storage when they are added
- store/use hosted URLs in `referenceImages` instead of long `data:` URLs
- only send lightweight HTTPS URLs to the AI model

If that is too broad for one pass, add an immediate safety layer:
- reject or compress oversized client-side uploads earlier
- lower the effective total inline payload threshold for references
- surface a specific validation error before the server function runs

Files likely touched:
- `src/routes/studio.create.tsx`
- `src/lib/studio-store.ts`
- `src/server/generate-sticker.ts`
- possibly a small upload helper if references need their own storage path

Expected result:
- much smaller upstream payloads
- fewer timeouts when using references

### 3) Use a faster image model for interactive generation
Change the interactive create flow off the slowest model:
- switch default generation from `google/gemini-3-pro-image-preview`
- to a faster image model better suited for UI interactions, such as `google/gemini-3.1-flash-image-preview` or `google/gemini-2.5-flash-image`

Recommended approach:
- use the faster model for Generate / Regenerate in the studio
- reserve the slower premium model only for a later “high quality final render” flow if needed

Expected result:
- lower latency
- fewer upstream timeouts
- better fit for repeated regenerate actions

### 4) Add a client-side guardrail for heavy generations
In `src/routes/studio.create.tsx`, add preflight checks before calling `generateSticker`:
- warn when the user has attached large references
- warn when multiple large refs are combined with the slowest settings
- disable obviously risky combinations or suggest removing references
- show a specific inline error if total ref payload is too large

This should happen before the network request begins.

Expected result:
- users understand why a request may fail before waiting for a timeout

### 5) Improve retry behavior and UX messaging
Refine the error handling around `runGeneration(...)`:
- treat timeout responses differently from generic failures
- suggest practical next steps:
  - retry once
  - remove one or more references
  - use a smaller image
  - switch to a lighter generation path if implemented
- keep the last good generation visible instead of making the experience feel broken

Expected result:
- retries feel intentional instead of random
- fewer “what just happened?” moments

### 6) Optional follow-up: move generation to an async job flow if timeouts persist
If the faster model + hosted refs still produce occasional 504s, implement an asynchronous backend job pattern:
- enqueue a generation job
- return immediately with a job id/status
- poll for completion from the client
- save and return the final artwork once ready

This is the strongest long-term fix for slow image generation, but it is a larger change than the lighter fixes above.

## Files to update
Primary:
- `src/server/generate-sticker.ts`
- `src/routes/studio.create.tsx`
- `src/lib/studio-store.ts`

Possible supporting files:
- `src/server/upload-artwork.server.ts` or a sibling helper for reference uploads
- a new backend job/polling layer only if async processing is needed

## Expected outcome
After these changes:
- the app no longer fails with vague timeout errors during normal regenerate use
- large reference images are handled more safely
- interactive generations complete faster
- users get clear guidance when a request is too heavy
- if needed, the flow can scale to async generation without blocking the request window
