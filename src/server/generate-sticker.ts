import { createServerFn } from "@tanstack/react-start";

type ReferenceImage = { url: string; role?: string };

type Body = {
  prompt: string;
  stylePreset?: string | null;
  referenceImages?: ReferenceImage[] | null; // up to 3
};

const STYLE_HINTS: Record<string, string> = {
  watercolor: "soft watercolor illustration with gentle washes",
  lineart: "clean minimal line-art illustration",
  vintage: "vintage label illustration with subtle texture",
  flat: "modern flat vector illustration with bold shapes",
  photographic: "photorealistic illustration with soft lighting",
  cartoon: "playful cartoon illustration with bold outlines",
};

function buildPrompt(prompt: string, stylePreset?: string | null, refs: ReferenceImage[] = []) {
  const style = stylePreset ? STYLE_HINTS[stylePreset] ?? "" : "";
  let refNote = "";
  if (refs.length === 1) {
    const role = (refs[0].role || "reference").toLowerCase();
    refNote = `Use the attached image as the ${role} reference. Reinterpret it as an illustration — do not copy the photo verbatim.`;
  } else if (refs.length > 1) {
    const roleList = refs
      .map((r, i) => `image ${i + 1} = ${(r.role || "reference").toLowerCase()}`)
      .join(", ");
    refNote = `You are given ${refs.length} reference images, each with a specific role: ${roleList}. Combine them into a single cohesive sticker, drawing each aspect from its assigned image. Reinterpret as an illustration — do not copy any photo verbatim.`;
  }
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
    const refs: ReferenceImage[] = Array.isArray(input.referenceImages)
      ? input.referenceImages
          .filter((r) => r && typeof r.url === "string" && r.url.length > 0)
          .map((r) => ({
            url: r.url,
            role: typeof r.role === "string" ? r.role.slice(0, 60) : "",
          }))
      : [];
    if (refs.length > 3) throw new Error("Up to 3 reference images allowed");
    const totalSize = refs.reduce((n, r) => n + r.url.length, 0);
    if (totalSize > 24_000_000) throw new Error("Reference images too large");
    return {
      prompt: input.prompt,
      stylePreset: input.stylePreset ?? null,
      referenceImages: refs,
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("AI is not configured. Please contact support.");
    }

    const refs = data.referenceImages;
    const fullPrompt = buildPrompt(data.prompt, data.stylePreset, refs);

    const userContent =
      refs.length > 0
        ? [
            { type: "text", text: fullPrompt },
            ...refs.map((r) => ({ type: "image_url", image_url: { url: r.url } })),
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
