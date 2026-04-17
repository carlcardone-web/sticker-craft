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
  watercolor:
    "Painted in soft watercolor — translucent layered washes, visible cold-press paper texture, gentle pigment bleeds at edges, no hard outlines, muted earthy palette of ochres, sage and dusty blues",
  lineart:
    "Fine clean line-art illustration — single-weight black ink outlines on light ground, botanical-illustration precision, minimal flat fills, delicate cross-hatching for shading, restrained monochrome palette",
  vintage:
    "Vintage engraved label illustration — etched linework with fine cross-hatching, aged sepia and deep jewel tones, ornamental scrollwork borders, 19th-century apothecary and wine-label aesthetic, subtle paper texture",
  flat:
    "Modern flat vector illustration — solid fills with no gradients, clean geometric shapes, bold colour blocking, confident silhouettes, Bauhaus-inspired simplicity, vibrant limited palette of three to five hues",
  photographic:
    "Photorealistic painted illustration — soft directional lighting, rich tonal depth, subtle film grain, naturalistic colour palette, painterly brushwork that reads as photographic from a distance, cinematic mood",
  cartoon:
    "Playful cartoon illustration — bold black outlines, expressive exaggerated shapes, cel-shaded flat fills with one shadow tone, bright saturated palette, friendly character-driven energy, comic-book finish",
};

const SHAPE_HINTS: Record<string, string> = {
  circle: "Compose for a CIRCULAR die-cut sticker — subject fills the circular frame edge-to-edge, no empty corners",
  square: "Compose for a SQUARE sticker — subject fills the square frame edge-to-edge, balanced composition",
  rectangle: "Compose for a horizontal RECTANGULAR sticker — subject fills the rectangular frame edge-to-edge",
  rounded: "Compose for a ROUNDED-SQUARE sticker — subject fills the rounded frame edge-to-edge",
  oval: "Compose for an OVAL sticker — subject fills the oval frame edge-to-edge",
  diecut: "Compose for a DIE-CUT contour sticker — subject silhouette defines the edge, fully painted interior",
};

const CONTAINER_HINTS: Record<string, string> = {
  wine:
    "Label artwork for a tall narrow Bordeaux/Burgundy wine bottle — central motif with ornamental framing, cream or off-white background typical of premium wine labels, refined classical composition",
  beer:
    "Label artwork for a beer bottle — bold characterful design, high-contrast colour blocking that reads clearly on curved brown or green glass, craft-brewery energy, confident central illustration",
  champagne:
    "Label artwork for a champagne bottle — celebratory premium feel, gold, cream and black palette, refined neck-label proportions, ornamental detailing, foil-stamp aesthetic",
  spirits:
    "Label artwork for a premium spirits bottle (whiskey, gin, vodka) — distinctive high-contrast composition, deep blacks with metallic accents, heritage distillery aesthetic, strong central emblem",
  can:
    "Label artwork that wraps a cylindrical beverage can — bold high-contrast graphics that read at a glance on a curved surface, no fine detail (it disappears on curves), punchy saturated palette",
  growler:
    "Label artwork for a growler — artisanal craft-beverage feel, bold and readable on a large vessel, hand-crafted illustration energy, confident typographic-style composition without actual letters",
};

const ASPECT_HINTS: Record<string, string> = {
  wine: "portrait orientation, taller than wide, label proportions roughly 2:3",
  beer: "landscape-leaning, slightly wider than tall, label proportions roughly 3:2",
  champagne: "near-square portrait label proportions roughly 1:1.2",
  spirits: "portrait, tall and narrow, label proportions roughly 2:3",
  can: "wide panoramic format that wraps a cylinder, label proportions roughly 3:1",
  growler: "landscape, wide and short, label proportions roughly 4:2",
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
  const aspectHint = container ? ASPECT_HINTS[container] ?? "" : "";
  const sizeHint = size ? SIZE_HINTS[size] ?? "" : "";
  const shapeWord = shape ?? "frame";

  const strictRules =
    "STRICT RULES: pure illustration only. No text, no words, no letters, no numbers, no watermark, no logo, no signature, no UI elements. NO transparent background, NO empty background, NO negative space, NO white padding";

  const containerCombined = [containerHint, aspectHint].filter(Boolean).join(" — ");

  const conflictNote =
    container && shape
      ? `This artwork will be applied as a ${container} label cut to a ${shape} shape. Prioritise the ${shape} frame fill, but reflect the ${container} label aesthetic in colour, motif, and mood.`
      : "";

  let refNote = "";
  if (refs.length === 1) {
    const role = (refs[0].role || "reference").toLowerCase();
    refNote = `Reference image: extract only the ${role} (e.g. colour palette, subject shape, brushwork style) from this image — do not copy the photo literally. Apply it to the sticker artwork.`;
  } else if (refs.length > 1) {
    const roleList = refs
      .map((r, i) => `image ${i + 1} = ${(r.role || "reference").toLowerCase()}`)
      .join(", ");
    refNote = `You are given ${refs.length} reference images, each with a specific role: ${roleList}. From each image extract only its assigned aspect (e.g. colour palette, subject shape, brushwork style) — do not copy any photo literally. Combine them into one cohesive sticker.`;
  }

  const fillRule = `Subject fills the entire ${shapeWord} frame edge-to-edge with solid fully-painted imagery.`;
  const renderClause = `Render as a print-quality illustration with crisp edges. The artwork must completely fill the ${shapeWord} frame with solid, fully-painted imagery — every pixel inside the frame is part of the illustration. No transparent areas.`;

  return [
    strictRules,
    prompt,
    style,
    shapeHint,
    containerCombined,
    sizeHint,
    conflictNote,
    refNote,
    fillRule,
    renderClause,
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
