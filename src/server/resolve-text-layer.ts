import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Body = { description: string };

const ALLOWED_FONTS = [
  "Inter",
  "Playfair Display",
  "Lora",
  "Caveat",
  "Bebas Neue",
  "Montserrat",
  "Dancing Script",
  "Cormorant Garamond",
];

const SYSTEM_PROMPT = `You design short text overlays for product stickers (wine, beer, spirits, craft labels).
Given a freeform description from the user, output strict JSON with this shape:
{
  "text": string,                  // the literal phrase to render on the sticker
  "suggestedFont": string,         // one of: ${ALLOWED_FONTS.join(", ")}
  "suggestedColor": string,        // a CSS hex color like "#1f2a24"
  "suggestedPosition": "top" | "middle" | "bottom"
}

Rules:
- If the description contains text inside straight ("...") or smart ("..." / '...') quotes, use that quoted text VERBATIM as "text". Do not paraphrase or rewrite it.
- Otherwise, propose a short, tasteful phrase (1–6 words) that matches the description.
- Pick the font from the allowed list that best fits the described mood (script for elegant/wedding, serif for classic, sans for modern, condensed for bold/industrial).
- Pick a color hex that matches the described mood. Default to a deep, readable color if unclear.
- Pick the position bucket the user implied (e.g. "along the top" -> "top"). Default to "bottom".
- Return ONLY the JSON object, no prose.`;

export const resolveTextLayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Body) => {
    if (!input?.description || typeof input.description !== "string") {
      throw new Error("Description is required");
    }
    const description = input.description.trim();
    if (!description) throw new Error("Description is required");
    if (description.length > 400) throw new Error("Description too long");
    return { description };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured. Please contact support.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: data.description },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Too many requests. Give it a moment and try again.");
      if (res.status === 402)
        throw new Error("AI credits are exhausted. Add credits in your workspace settings to keep generating.");
      const text = await res.text().catch(() => "");
      console.error("Lovable AI resolve-text-layer error", res.status, text);
      throw new Error("Could not interpret the text description. Please try again.");
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: {
      text?: string;
      suggestedFont?: string;
      suggestedColor?: string;
      suggestedPosition?: string;
    } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      // try to extract JSON from any wrapping
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          /* noop */
        }
      }
    }

    const text = (parsed.text ?? "").toString().slice(0, 120).trim();
    if (!text) throw new Error("Could not extract text from your description.");

    const suggestedFont = ALLOWED_FONTS.includes(parsed.suggestedFont ?? "")
      ? (parsed.suggestedFont as string)
      : null;
    const suggestedColor =
      typeof parsed.suggestedColor === "string" && /^#[0-9a-fA-F]{6}$/.test(parsed.suggestedColor)
        ? parsed.suggestedColor
        : null;
    const suggestedPosition =
      parsed.suggestedPosition === "top" ||
      parsed.suggestedPosition === "middle" ||
      parsed.suggestedPosition === "bottom"
        ? parsed.suggestedPosition
        : null;

    return { text, suggestedFont, suggestedColor, suggestedPosition };
  });
