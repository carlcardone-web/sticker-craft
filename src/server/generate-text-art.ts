import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { persistArtwork } from "@/server/upload-artwork.server";

type ReferenceImage = { url: string; role?: string };

type Body = {
  text: string;
  prompt: string;
  references?: ReferenceImage[] | null;
  color?: string | null;
};

function buildPrompt(text: string, prompt: string, refs: ReferenceImage[], color?: string | null) {
  const roleList = refs.length
    ? refs
        .map((r, i) => `image ${i + 1} = ${(r.role || "reference").toLowerCase()}`)
        .join(", ")
    : "";
  const refNote = roleList
    ? `Reference images provided, each with a role: ${roleList}. Extract only the assigned aspect from each (e.g. font style → letterforms, color palette → hues, mood → feel). Do not copy any image literally.`
    : "";
  const colorNote = color ? `Primary color hint: ${color}.` : "";

  return [
    `Render the EXACT phrase "${text}" as decorative typography.`,
    `Style: ${prompt}.`,
    colorNote,
    refNote,
    "STRICT RULES: transparent background (PNG with alpha), render ONLY the letters of the phrase, no frame, no border, no decoration outside the letterforms, no extra words, no watermark, no signature. Crisp clean edges. The letters should fill the canvas tightly with minimal padding. The phrase must be spelled exactly as given.",
  ]
    .filter(Boolean)
    .join(" ");
}

export const generateTextArt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Body) => {
    if (!input?.text || typeof input.text !== "string") throw new Error("Text is required");
    if (!input?.prompt || typeof input.prompt !== "string") throw new Error("Style prompt is required");
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
    const totalSize = refs.reduce((n, r) => n + r.url.length, 0);
    if (totalSize > 16_000_000) throw new Error("Reference images too large");
    return {
      text: input.text,
      prompt: input.prompt,
      references: refs,
      color: typeof input.color === "string" ? input.color.slice(0, 32) : null,
    };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured. Please contact support.");

    const fullPrompt = buildPrompt(data.text, data.prompt, data.references, data.color);
    const userContent =
      data.references.length > 0
        ? [
            { type: "text", text: fullPrompt },
            ...data.references.map((r) => ({ type: "image_url", image_url: { url: r.url } })),
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
      if (res.status === 429) throw new Error("Too many requests. Give it a moment and try again.");
      if (res.status === 402)
        throw new Error("AI credits are exhausted. Add credits in your workspace settings to keep generating.");
      const text = await res.text().catch(() => "");
      console.error("Lovable AI text-art error", res.status, text);
      throw new Error("Text generation failed. Please try again.");
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
    };
    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error("No image returned. Try a different prompt.");
    const publicUrl = await persistArtwork({ imageUrl: url, userId: context.userId });
    return { imageUrl: publicUrl };
  });
