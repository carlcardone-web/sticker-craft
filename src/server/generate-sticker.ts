import { createServerFn } from "@tanstack/react-start";
import { getLabelDimensions } from "@/lib/studio-store";

type ReferenceImage = { url: string; role?: string };

type Body = {
    prompt: string;
    stylePreset?: string | null;
    referenceImages?: ReferenceImage[] | null; // up to 3
    container?: string | null;
    shape?: string | null;
    volume?: string | null;
};

const STYLE_HINTS: Record<string, string> = {
    "fine-wine":
          "Premium wine label in classical engraved style — fine etched linework, botanical motifs, cream and deep green or burgundy palette, 19th-century European winery aesthetic, ornamental framing, restrained serif sensibility",
    "craft-beer":
          "Craft brewery label illustration — bold confident linework, high-contrast colour blocking, characterful central illustration (animal, landscape or heraldic crest), limited earthy or vibrant palette, hand-drawn energy",
    "natural-wine":
          "Natural wine label in loose soft watercolour — expressive wet washes, organic irregular shapes, muted botanical palette of sage, terracotta and dusty rose, handmade imperfect feel, no rigid outlines",
    "premium-spirits":
          "Premium spirits label in heritage engraving style — deep inky blacks with metallic gold or copper accents, intricate cross-hatched linework, distillery crest or heraldic emblem, distinguished gravitas",
    "sparkling":
          "Sparkling wine label — luminous celebratory feel, gold-foil aesthetic, fine filigree ornament, soft champagne and ivory tones with gold accents, elegant and festive, Art Deco influence",
    "modern-label":
          "Contemporary minimal label design — clean flat vector illustration, confident bold shapes, restrained palette of two or three colours, Swiss graphic-design influence, geometric motifs, no ornamentation",
};

const SHAPE_HINTS: Record<string, string> = {
    rectangle: "Compose for a RECTANGULAR label (portrait 3:4) — subject fills the rectangular frame edge-to-edge",
    oval: "Compose for an OVAL label (portrait 3:4) — subject fills the oval frame edge-to-edge, no empty corners",
    circle: "Compose for a CIRCULAR neck-seal / cap sticker — subject fills the circular frame edge-to-edge",
    diecut: "Compose for a DIE-CUT contour label — subject silhouette defines the edge, fully painted interior",
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
          "Label artwork that wraps a cylindrical beverage can — bold high-contrast graphics that read at a glance on a curved surface, no fine detail, punchy saturated palette",
    growler:
          "Label artwork for a growler — artisanal craft-beverage feel, bold and readable on a large vessel, hand-crafted illustration energy, confident typographic-style composition without actual letters",
};

function buildPrompt(
    prompt: string,
    stylePreset?: string | null,
    refs: ReferenceImage[] = [],
    container?: string | null,
    shape?: string | null,
    volume?: string | null,
  ) {
    const style = stylePreset ? STYLE_HINTS[stylePreset] ?? "" : "";
    const shapeHint = shape ? SHAPE_HINTS[shape] ?? "" : "";
    const containerHint = container ? CONTAINER_HINTS[container] ?? "" : "";
    const shapeWord = shape ?? "frame";

    const strictRules =
          "STRICT RULES: pure illustration only. No text, no words, no letters, no numbers, no watermark, no logo, no signature, no UI elements. NO transparent background, NO empty background, NO negative space, NO white padding";

    const dims = getLabelDimensions(container, volume);
    const dimensionNote = dims && container && volume
        ? `Compose for a label printed at exactly ${dims.w} cm wide × ${dims.h} cm tall (aspect ratio ${dims.w}:${dims.h}${dims.kind === "wrap" ? ", panoramic full-wrap format" : ""}). Every element must be sized and positioned to read clearly at this physical scale on a ${volume} ${container}.`
        : "";

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
          volumeNote,
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
                volume: typeof input.volume === "string" ? input.volume.slice(0, 20) : null,
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
                data.volume,
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
