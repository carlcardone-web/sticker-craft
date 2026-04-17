import { createServerFn } from "@tanstack/react-start";

type ReferenceImage = { url: string; role?: string };

type Body = {
  prompt: string;
  stylePreset?: string | null;
  referenceImages?: ReferenceImage[] | null; // up to 3
  container?: string | null;
  shape?: string | null;
  size?: string | null;
};

const STYLE_HINTS: Record<string, string> = {
  watercolor: "soft watercolor illustration with gentle washes",
  lineart: "clean minimal line-art illustration",
  vintage: "vintage label illustration with subtle texture",
  flat: "modern flat vector illustration with bold shapes",
  photographic: "photorealistic illustration with soft lighting",
  cartoon: "playful cartoon illustration with bold outlines",
};

const SHAPE_HINTS: Record<string, string> = {
  circle: "Compose for a CIRCULAR die-cut sticker — subject fills the circular frame edge-to-edge, no empty corners",
  square: "Compose for a SQUARE sticker — subject fills the square frame edge-to-edge, balanced composition",
  rectangle: "Compose for a horizontal RECTANGULAR sticker — subject fills the rectangular frame edge-to-edge",
  rounded: "Compose for a ROUNDED-SQUARE sticker — subject fills the rounded frame edge-to-edge",
  oval: "Compose for an OVAL sticker — subject fills the oval frame edge-to-edge",
  diecut: "Compose for a DIE-CUT contour sticker — subject silhouette defines the edge, no background",
};

const CONTAINER_HINTS: Record<string, string> = {
  wine: "Designed as a wine bottle label — elegant, refined proportions suited to a curved bottle",
  beer: "Designed as a beer bottle label — bold, characterful, readable on a curved brown or green bottle",
  champagne: "Designed as a champagne bottle label — celebratory, premium feel with refined detailing",
  spirits: "Designed as a spirits bottle label (whiskey, gin, vodka) — premium, distinctive, high-contrast",
  can: "Designed to wrap a beverage can — bold, punchy, readable at a glance on a cylindrical can",
  growler: "Designed as a growler label — craft beverage feel, bold and artisanal on a large vessel",
};

const SIZE_HINTS: Record<string, string> = {
  "2in": "Sized at 2 inches — keep details bold and readable at very small scale",
  "3in": "Sized at 3 inches — bold details, readable at small scale",
  "4in": "Sized at 4 inches — room for moderate detail",
  "5in": "Sized at 5 inches — room for richer detail",
};

function buildPrompt(
  prompt: string,
  stylePreset?: string | null,
  refs: ReferenceImage[] = [],
  container?: string | null,
  shape?: string | null,
  size?: string | null
) {
  const style = stylePreset ? STYLE_HINTS[stylePreset] ?? "" : "";
  const shapeHint = shape ? SHAPE_HINTS[shape] ?? "" : "";
  const containerHint = container ? CONTAINER_HINTS[container] ?? "" : "";
  const sizeHint = size ? SIZE_HINTS[size] ?? "" : "";
  const shapeWord = shape ?? "frame";

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
    shapeHint,
    containerHint,
    sizeHint,
    refNote,
    `Subject fills the entire ${shapeWord} frame edge-to-edge. No empty background, no padding, no watermark, no signature, no text, no typography.`,
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
      container: typeof input.container === "string" ? input.container.slice(0, 40) : null,
      shape: typeof input.shape === "string" ? input.shape.slice(0, 40) : null,
      size: typeof input.size === "string" ? input.size.slice(0, 10) : null,
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("AI is not configured. Please contact support.");
    }

    const refs = data.referenceImages;
    const fullPrompt = buildPrompt(
      data.prompt,
      data.stylePreset,
      refs,
      data.container,
      data.shape,
      data.size
    );

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
