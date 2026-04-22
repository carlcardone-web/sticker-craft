import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { persistArtwork } from "@/server/upload-artwork.server";

type ReferenceImage = { url: string; role?: string; weight?: number };

type Body = {
  prompt: string;
  negativePrompt?: string | null;
  seed?: number | null;
  referenceImages?: ReferenceImage[] | null;
};

const MAX_IMAGE_SEED = 2_147_483_647;

function normalizeSeed(seed: number | null | undefined) {
  if (typeof seed !== "number" || !Number.isFinite(seed)) return null;
  const normalized = Math.abs(Math.trunc(seed)) % (MAX_IMAGE_SEED + 1);
  return normalized;
}

export const generateSticker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Body) => {
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

    if (refs.length > 3) throw new Error("Up to 3 reference images allowed");
    const totalSize = refs.reduce((sum, ref) => sum + ref.url.length, 0);
    if (totalSize > 24_000_000) throw new Error("Reference images too large");

    return {
      prompt: input.prompt.trim(),
      negativePrompt: typeof input.negativePrompt === "string" ? input.negativePrompt.slice(0, 1200) : "",
      seed: normalizeSeed(input.seed),
      referenceImages: refs,
    };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("AI is not configured. Please contact support.");
    }

    const userContent = [
      {
        type: "text",
        text: [data.prompt, data.negativePrompt ? `Negative prompt: ${data.negativePrompt}` : ""]
          .filter(Boolean)
          .join("\n\n"),
      },
      ...data.referenceImages.map((ref) => ({ type: "image_url", image_url: { url: ref.url } })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: userContent }],
        modalities: ["image", "text"],
        seed: data.seed ?? undefined,
        negative_prompt: data.negativePrompt || undefined,
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        throw new Error("Too many requests. Give it a moment and try again.");
      }
      if (res.status === 402) {
        throw new Error("AI credits are exhausted. Add credits in your workspace settings to keep generating.");
      }
      const text = await res.text().catch(() => "");
      console.error("Lovable AI error", res.status, text);
      throw new Error("Image generation failed. Please try again.");
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
    };

    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error("No image returned. Try a different prompt.");

    const publicUrl = await persistArtwork({ imageUrl: url, userId: context.userId });
    return { imageUrl: publicUrl };
  });
