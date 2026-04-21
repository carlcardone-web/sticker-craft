import { createServerFn } from "@tanstack/react-start";
import { getLabelDimensions } from "@/lib/studio-store";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { persistArtwork } from "@/server/upload-artwork.server";

type ReferenceImage = { url: string; role?: string };

type Body = {
  baseImageUrl: string;
  text: string;
  prompt: string;
  references?: ReferenceImage[] | null;
  shape?: string | null;
  container?: string | null;
  volume?: string | null;
  color?: string | null;
};

function buildPrompt(
  text: string,
  prompt: string,
  refs: ReferenceImage[],
  shape?: string | null,
  container?: string | null,
  volume?: string | null,
  color?: string | null,
) {
  const dims = getLabelDimensions(container, volume);
  const dimensionNote = dims
    ? `Preserve the original aspect ratio (${dims.w}:${dims.h}).`
    : "Preserve the original aspect ratio.";

  const roleList = refs.length
    ? refs
        .map((r, i) => `image ${i + 2} = ${(r.role || "reference").toLowerCase()}`)
        .join(", ")
    : "";
  const refNote = roleList
    ? `Additional reference images guide the lettering treatment only: ${roleList}. Extract only the assigned aspect from each (font style → letterforms, color palette → hues, mood → feel). Do not introduce subjects from these references.`
    : "";

  const colorNote = color ? `Lettering color hint: ${color}.` : "";
  const shapeNote = shape ? `Sticker shape: ${shape}.` : "";

  return [
    `Edit the provided sticker artwork (image 1) by integrating the EXACT phrase "${text}" into the design.`,
    `Style for the lettering: ${prompt}.`,
    colorNote,
    shapeNote,
    `Keep the existing composition, palette, subject matter, and overall mood of image 1 unchanged — only add the lettering so it sits naturally as part of the design, as if it were always there.`,
    `Do not add unrelated elements, do not crop, do not change the background.`,
    refNote,
    dimensionNote,
    `Output a complete sticker artwork as a single image. The phrase must be spelled exactly as given. No watermark, no signature.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export const editStickerWithText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Body) => {
    if (!input?.baseImageUrl || typeof input.baseImageUrl !== "string")
      throw new Error("Base image is required");
    if (!input?.text || typeof input.text !== "string") throw new Error("Text is required");
    if (!input?.prompt || typeof input.prompt !== "string")
      throw new Error("Style prompt is required");
    if (input.text.length > 120) throw new Error("Text too long");
    if (input.prompt.length > 600) throw new Error("Prompt too long");
    const refs: ReferenceImage[] = Array.isArray(input.references)
      ? input.references
          .filter((r) => r && typeof r.url === "string" && r.url.length > 0)
          .map((r) => ({
            url: r.url,
            role: typeof r.role === "string" ? r.role.slice(0, 60) : "",
          }))
      : [];
    if (refs.length > 2) throw new Error("Up to 2 reference images allowed");
    return {
      baseImageUrl: input.baseImageUrl,
      text: input.text,
      prompt: input.prompt,
      references: refs,
      shape: typeof input.shape === "string" ? input.shape.slice(0, 40) : null,
      container: typeof input.container === "string" ? input.container.slice(0, 40) : null,
      volume: typeof input.volume === "string" ? input.volume.slice(0, 20) : null,
      color: typeof input.color === "string" ? input.color.slice(0, 32) : null,
    };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured. Please contact support.");

    const fullPrompt = buildPrompt(
      data.text,
      data.prompt,
      data.references,
      data.shape,
      data.container,
      data.volume,
      data.color,
    );

    const userContent = [
      { type: "text", text: fullPrompt },
      { type: "image_url", image_url: { url: data.baseImageUrl } },
      ...data.references.map((r) => ({ type: "image_url", image_url: { url: r.url } })),
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
      }),
    });

    if (!res.ok) {
      if (res.status === 429)
        throw new Error("Too many requests. Give it a moment and try again.");
      if (res.status === 402)
        throw new Error(
          "AI credits are exhausted. Add credits in your workspace settings to keep generating.",
        );
      const text = await res.text().catch(() => "");
      console.error("Lovable AI edit-sticker error", res.status, text);
      throw new Error("Text bake-in failed. Please try again.");
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
    };
    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error("No image returned. Try a different prompt.");
    const publicUrl = await persistArtwork({ imageUrl: url, userId: context.userId });
    return { imageUrl: publicUrl };
  });
