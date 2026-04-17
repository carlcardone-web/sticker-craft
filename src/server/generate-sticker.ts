import { createServerFn } from "@tanstack/react-start";

type Body = {
  prompt: string;
  stylePreset?: string | null;
  referenceImage?: string | null; // data URL or https URL
};

const STYLE_HINTS: Record<string, string> = {
  watercolor: "soft watercolor illustration with gentle washes",
  lineart: "clean minimal line-art illustration",
  vintage: "vintage label illustration with subtle texture",
  flat: "modern flat vector illustration with bold shapes",
  photographic: "photorealistic illustration with soft lighting",
  cartoon: "playful cartoon illustration with bold outlines",
};

function buildPrompt(prompt: string, stylePreset?: string | null, hasReference?: boolean) {
  const style = stylePreset ? STYLE_HINTS[stylePreset] ?? "" : "";
  const refNote = hasReference
    ? "Use the attached image as a visual reference for the subject (likeness, pose, key features). Reinterpret it as an illustration — do not copy the photo verbatim."
    : "";
  return [
    prompt,
    style,
    refNote,
    "Designed as a die-cut sticker: subject centered, clean composition, vibrant but tasteful colors, on a transparent or solid white background, no text or typography, no watermark.",
  ]
    .filter(Boolean)
    .join(". ");
}

export const generateSticker = createServerFn({ method: "POST" })
  .inputValidator((input: Body) => {
    if (!input?.prompt || typeof input.prompt !== "string") {
      throw new Error("Prompt is required");
    }
    if (input.prompt.length > 1000) throw new Error("Prompt too long");
    const ref = input.referenceImage ?? null;
    if (ref && typeof ref !== "string") throw new Error("Invalid reference image");
    if (ref && ref.length > 12_000_000) throw new Error("Reference image too large");
    return {
      prompt: input.prompt,
      stylePreset: input.stylePreset ?? null,
      referenceImage: ref,
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("AI is not configured. Please contact support.");
    }

    const hasRef = !!data.referenceImage;
    const fullPrompt = buildPrompt(data.prompt, data.stylePreset, hasRef);

    const userContent = hasRef
      ? [
          { type: "text", text: fullPrompt },
          { type: "image_url", image_url: { url: data.referenceImage as string } },
        ]
      : fullPrompt;

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
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        throw new Error("Too many requests. Give it a moment and try again.");
      }
      if (res.status === 402) {
        throw new Error(
          "AI credits are exhausted. Add credits in your workspace settings to keep generating."
        );
      }
      const text = await res.text().catch(() => "");
      console.error("Lovable AI error", res.status, text);
      throw new Error("Image generation failed. Please try again.");
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: { images?: Array<{ image_url?: { url?: string } }> };
      }>;
    };
    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error("No image returned. Try a different prompt.");
    return { imageUrl: url };
  });
