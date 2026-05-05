import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { persistArtwork } from "@/server/upload-artwork.server";

type Body = {
  artworkUrl: string;
  container: string | null;
  volume: string | null;
};

const CONTAINER_DESCRIPTIONS: Record<string, string> = {
  wine: "a tall classic wine bottle made of dark green glass with a long neck and clean foil-free finish",
  champagne: "a champagne bottle with a heavier punted base, foiled neck, and an elegant silhouette",
  beer: "a standard 330ml long-neck beer bottle in amber glass",
  spirits: "a premium clear-glass spirits bottle with broad shoulders and a short neck",
  can: "a slim aluminium beverage can with a clean unprinted brushed-metal surface",
  growler: "a refillable amber-glass growler with a wide body and short neck",
};

function buildMockupPrompt(container: string | null) {
  const desc = (container && CONTAINER_DESCRIPTIONS[container]) || CONTAINER_DESCRIPTIONS.wine;
  return [
    `Create a photorealistic studio product photograph of ${desc}.`,
    `Wrap the provided artwork (image 1) onto the container as the front label, perfectly aligned, with realistic curvature, lighting, shadows and subtle reflections. Do NOT alter the artwork's content, colors, or composition — preserve every detail.`,
    `The container should be centered on a soft, neutral light-grey seamless studio background with gentle shadow beneath. Premium ecommerce product shot. No text, no watermark, no extra props.`,
  ].join(" ");
}

export const composeMockup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Body) => {
    if (!input?.artworkUrl || typeof input.artworkUrl !== "string") {
      throw new Error("Artwork is required");
    }
    return {
      artworkUrl: input.artworkUrl,
      container: typeof input.container === "string" ? input.container.slice(0, 40) : null,
      volume: typeof input.volume === "string" ? input.volume.slice(0, 20) : null,
    };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured. Please contact support.");

    const prompt = buildMockupPrompt(data.container);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: data.artworkUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Too many requests. Try again in a moment.");
      if (res.status === 402)
        throw new Error("AI credits are exhausted. Add credits to keep generating.");
      const text = await res.text().catch(() => "");
      console.error("compose-mockup error", res.status, text);
      throw new Error("Mockup generation failed. Please try again.");
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
    };
    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error("No mockup returned. Please try again.");
    const publicUrl = await persistArtwork({ imageUrl: url, userId: context.userId });
    return { imageUrl: publicUrl };
  });
