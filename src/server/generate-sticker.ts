import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ReferenceImage = { url: string; role?: string; weight?: number };

type EnqueueBody = {
  prompt: string;
  negativePrompt?: string | null;
  seed?: number | null;
  referenceImages?: ReferenceImage[] | null;
};

const MAX_IMAGE_SEED = 2_147_483_647;
const MAX_REFERENCE_TOTAL_SIZE = 8_000_000;

function normalizeSeed(seed: number | null | undefined) {
  if (typeof seed !== "number" || !Number.isFinite(seed)) return null;
  return Math.abs(Math.trunc(seed)) % (MAX_IMAGE_SEED + 1);
}

/**
 * Enqueue a generation job. Returns immediately with a jobId.
 * The actual AI call runs in a background worker route triggered via pg_net.
 * Client polls getGenerationStatus to know when the result is ready.
 */
export const generateSticker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EnqueueBody) => {
    if (!input?.prompt || typeof input.prompt !== "string") {
      throw new Error("Prompt is required");
    }
    if (input.prompt.length > 1000) throw new Error("Prompt too long");

    const refs: ReferenceImage[] = Array.isArray(input.referenceImages)
      ? input.referenceImages
          .filter((ref) => ref && typeof ref.url === "string" && ref.url.length > 0)
          .map((ref) => ({
            url: ref.url,
            role: typeof ref.role === "string" ? ref.role.slice(0, 60) : "",
            weight: typeof ref.weight === "number" ? Math.min(1, Math.max(0.2, ref.weight)) : 0.7,
          }))
      : [];

    const inlineRef = refs.find((r) => r.url.startsWith("data:"));
    if (inlineRef) {
      throw new Error(
        "A reference image is still uploading or wasn't uploaded successfully. Remove it and re-upload before generating.",
      );
    }

    if (refs.length > 3) throw new Error("Up to 3 reference images allowed");
    const totalSize = refs.reduce((sum, ref) => sum + ref.url.length, 0);
    if (totalSize > MAX_REFERENCE_TOTAL_SIZE) {
      throw new Error("References are too large. Try fewer or smaller images.");
    }

    return {
      prompt: input.prompt.trim(),
      negativePrompt: typeof input.negativePrompt === "string" ? input.negativePrompt.slice(0, 1200) : "",
      seed: normalizeSeed(input.seed),
      referenceImages: refs,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Reap any stale jobs first (cheap, indexed)
    try {
      await supabase.rpc("reap_stale_generation_jobs");
    } catch (e) {
      console.warn("reap_stale_generation_jobs failed", e);
    }

    const { data: job, error } = await supabase
      .from("generation_jobs")
      .insert({
        user_id: userId,
        status: "pending",
        prompt: data.prompt,
        negative_prompt: data.negativePrompt || null,
        seed: data.seed,
        reference_images: data.referenceImages,
      })
      .select("id")
      .single();

    if (error || !job) {
      console.error("enqueue generation job failed", error);
      throw new Error("Could not start generation. Please try again.");
    }

    return { jobId: job.id as string };
  });

type StatusBody = { jobId: string };

export const getGenerationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StatusBody) => {
    if (!input?.jobId || typeof input.jobId !== "string") {
      throw new Error("jobId is required");
    }
    return { jobId: input.jobId };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Opportunistic reaper
    try {
      await supabase.rpc("reap_stale_generation_jobs");
    } catch {
      // ignore
    }

    const { data: row, error } = await supabase
      .from("generation_jobs")
      .select("status, image_url, error_message")
      .eq("id", data.jobId)
      .maybeSingle();

    if (error) {
      console.error("getGenerationStatus failed", error);
      throw new Error("Could not check generation status.");
    }
    if (!row) throw new Error("Generation job not found.");

    return {
      status: row.status as "pending" | "running" | "done" | "failed",
      imageUrl: row.image_url as string | null,
      errorMessage: row.error_message as string | null,
    };
  });
