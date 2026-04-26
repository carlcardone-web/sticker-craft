## Fix the image generation timeout

### What is happening
The generation request is still sending a full `data:image/jpeg;base64,...` reference image directly to the image model. The network log shows the reference is embedded in the `generateSticker` request body instead of being sent as a short hosted URL. That makes the payload very large and the AI request times out before it can return an image.

### Plan
1. **Stop inline reference images from reaching generation**
   - Update the generation flow so `generateSticker` only receives hosted `http(s)` reference URLs.
   - If any persisted old references in the browser are still `data:` URLs, upload/convert them before generation or block them with a clear message.

2. **Make reference uploads safer**
   - Change the upload flow to add a temporary “uploading” reference state or only add the reference after the backend returns a hosted URL.
   - Add client-side checks that prevent generate/regenerate while a reference upload is still in progress.
   - If upload fails, show a clear toast and do not leave the base64 image in the stored references.

3. **Clean up old stored base64 references**
   - Add a lightweight startup cleanup/migration for the studio store so old `data:` reference images from prior versions are removed or re-uploaded instead of silently reused.
   - This directly addresses the current stuck state where the same base64 reference is repeatedly sent and times out.

4. **Harden the server function**
   - In `src/server/generate-sticker.ts`, reject `data:` references before calling the AI model with a user-friendly error.
   - Keep the timeout handling, but make sure the client sees the clearer reason when references are the cause.

5. **Optional speed improvement**
   - Use the faster image model only if quality remains acceptable, and keep the prompt payload concise.
   - The main fix is reference URL conversion, not just changing the model.

### Files to update
- `src/routes/studio.create.tsx`
- `src/lib/studio-store.ts`
- `src/server/generate-sticker.ts`
- Possibly `src/server/upload-reference.functions.ts` / `src/server/upload-artwork.server.ts` if upload validation needs tightening

### Expected result
After this fix, clicking generate should no longer send megabytes of base64 image data to the AI request. Existing problematic references will be cleaned up or converted, generation will fail fast with a helpful message if a reference is invalid, and normal image generation should complete much more reliably.