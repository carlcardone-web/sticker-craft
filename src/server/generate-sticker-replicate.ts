import { createServerFn } from "@tanstack/react-start";

type Body = {
  prompt: string;
  stylePreset?: string | null;
  quality?: "fast" | "high";
};

const STYLE_HINTS: Record<string, string> = {
  watercolor: "soft watercolor illustration",
  lineart: "clean minimal line art",
  vintage: "vintage label, subtle texture",
  flat: "modern flat vector, bold shapes",
  photographic: "photorealistic, soft lighting",
  cartoon: "playful cartoon, bold outlines",
};

function buildPrompt(prompt: string, stylePreset?: string | null) {
  const style = stylePreset ? STYLE_HINTS[stylePreset] ?? "" : "";
  return [
    prompt,
    style,
    "die-cut sticker, centered subject, white background, vector-like, no text, no watermark",
  ]
    .filter(Boolean)
    .join(", ");
}

const MODEL_VERSIONS: Record<"fast" | "high", string> = {
  // Flux Schnell (fast)
  fast: "black-forest-labs/flux-schnell",
  // Flux Dev (quality)
  high: "black-forest-labs/flux-dev",
};

export const generateStickerReplicate = createServerFn({ method: "POST" })
  .inputValidator((input: Body) => {
    if (!input?.prompt || typeof input.prompt !== "string") {
      throw new Error("Prompt is required");
    }
    if (input.prompt.length > 1000) throw new Error("Prompt too long");
    return {
      prompt: input.prompt,
      stylePreset: input.stylePreset ?? null,
      quality: input.quality === "high" ? "high" : "fast",
    } as Required<Body>;
  })
  .handler(async ({ data }) => {
    const token = process.env.REPLICATE_API_KEY;
    if (!token) {
      throw new Error(
        "Replicate API key is missing. Add it in settings to use Flux models."
      );
    }

    const modelSlug = MODEL_VERSIONS[data.quality];
    const fullPrompt = buildPrompt(data.prompt, data.stylePreset);

    // Create prediction via official model endpoint
    const createRes = await fetch(
      `https://api.replicate.com/v1/models/${modelSlug}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          input: {
            prompt: fullPrompt,
            aspect_ratio: "1:1",
            output_format: "png",
            num_outputs: 1,
          },
        }),
      }
    );

    if (!createRes.ok) {
      const text = await createRes.text().catch(() => "");
      console.error("Replicate create error", createRes.status, text);
      if (createRes.status === 401) throw new Error("Invalid Replicate API key.");
      throw new Error("Replicate request failed. Please try again.");
    }

    let prediction = (await createRes.json()) as {
      id: string;
      status: string;
      output?: string | string[];
      error?: string;
      urls?: { get?: string };
    };

    // Poll if still running (Prefer: wait usually returns terminal state)
    const started = Date.now();
    while (
      (prediction.status === "starting" || prediction.status === "processing") &&
      Date.now() - started < 60_000
    ) {
      await new Promise((r) => setTimeout(r, 1500));
      const getUrl = prediction.urls?.get;
      if (!getUrl) break;
      const pollRes = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      prediction = await pollRes.json();
    }

    if (prediction.status !== "succeeded") {
      console.error("Replicate prediction failed", prediction);
      throw new Error(prediction.error || "Generation failed. Try again.");
    }

    const out = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;
    if (!out) throw new Error("No image returned from Replicate.");
    return { imageUrl: out };
  });
