import { STYLE_PRESETS } from "@/lib/studio-store";
import type { StickerShape } from "@/lib/studio-store";

export type ReferenceImageInput = {
  id: string;
  url: string;
  role: string;
  weight?: number;
};

export type BuildPromptInput = {
  userText: string;
  stylePresetId: string | null;
  shape: StickerShape;
  container: string;
  volume: string;
  referenceImages: ReferenceImageInput[];
  realism: number;
  hue: number;
  saturation: number;
  lightness: number;
  colorInfluence: number;
};

export type BuiltPrompt = {
  prompt: string;
  negativePrompt: string;
  debug: Record<string, string>;
};

const GLOBAL_NEGATIVE = [
  "no text",
  "no watermark",
  "no signature",
  "no logo",
  "no photo background",
  "no drop shadow",
  "no frame",
  "no border",
  "no extra limbs",
  "no deformed hands",
  "no realistic skin pores",
  "no blurry edges",
  "transparent or flat background",
].join(", ");

function realismPhrase(v: number): string {
  if (v < 20) return "flat vector illustration, clean shapes, no shading";
  if (v < 45) return "soft hand-drawn illustration, gentle watercolor feel";
  if (v < 70) return "semi-realistic digital painting, moderate detail";
  if (v < 90) return "highly detailed illustration with realistic lighting";
  return "photorealistic studio render, sharp focus, lifelike materials";
}

function colorInfluencePhrase(v: number): string {
  if (v < 25) return "with subtle hints of";
  if (v < 55) return "accented by";
  if (v < 80) return "featuring";
  return "dominated by";
}

export const NAMED_COLORS: Array<{ name: string; h: number; s: number; l: number }> = [
  { name: "ivory white", h: 45, s: 20, l: 95 },
  { name: "soft cream", h: 40, s: 35, l: 88 },
  { name: "warm beige", h: 35, s: 30, l: 78 },
  { name: "dusty rose", h: 350, s: 30, l: 75 },
  { name: "coral red", h: 10, s: 75, l: 60 },
  { name: "burgundy", h: 350, s: 55, l: 30 },
  { name: "terracotta", h: 15, s: 55, l: 50 },
  { name: "mustard gold", h: 45, s: 70, l: 55 },
  { name: "champagne gold", h: 45, s: 40, l: 70 },
  { name: "olive green", h: 80, s: 40, l: 40 },
  { name: "sage green", h: 120, s: 20, l: 65 },
  { name: "eucalyptus", h: 150, s: 25, l: 60 },
  { name: "forest green", h: 140, s: 55, l: 25 },
  { name: "mint", h: 160, s: 45, l: 80 },
  { name: "teal", h: 180, s: 55, l: 40 },
  { name: "sky blue", h: 205, s: 60, l: 75 },
  { name: "denim blue", h: 215, s: 45, l: 45 },
  { name: "navy blue", h: 220, s: 60, l: 25 },
  { name: "lavender", h: 260, s: 35, l: 78 },
  { name: "deep plum", h: 290, s: 45, l: 30 },
  { name: "blush pink", h: 340, s: 55, l: 85 },
  { name: "charcoal", h: 220, s: 8, l: 20 },
  { name: "slate gray", h: 215, s: 10, l: 50 },
  { name: "warm taupe", h: 25, s: 12, l: 55 },
  { name: "chocolate brown", h: 20, s: 45, l: 25 },
  { name: "copper", h: 20, s: 60, l: 45 },
  { name: "peach", h: 25, s: 70, l: 78 },
  { name: "lemon yellow", h: 55, s: 85, l: 70 },
  { name: "aqua", h: 190, s: 65, l: 65 },
  { name: "midnight black", h: 0, s: 0, l: 8 },
];

function hueDist(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function nearestNamedColor(h: number, s: number, l: number): string {
  let best = NAMED_COLORS[0];
  let bestScore = Infinity;

  for (const c of NAMED_COLORS) {
    const score = hueDist(h, c.h) * 1.0 + Math.abs(s - c.s) * 0.5 + Math.abs(l - c.l) * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best.name;
}

function compositionRules(shape: StickerShape, container: string, volume: string): string {
  const shapeRule: Record<StickerShape, string> = {
    circle: "square composition, subject centered, ~10% safe margin on all sides",
    oval: "portrait oval composition, vertically centered, ~12% safe margin",
    square: "square composition, balanced symmetry, ~8% safe margin",
    rectangle: "wide landscape composition, horizon-friendly layout, ~8% safe margin",
    rounded: "square composition with gentle rounded corners, ~8% safe margin",
    diecut: "subject fills the frame, no background — designed to be cut out",
  };

  const curved = /bottle|can/i.test(container)
    ? "designed for a curved surface — keep key elements within the central 70% horizontal band"
    : "designed for a flat surface";

  return `${shapeRule[shape]}, ${curved}, sized for a ${volume} ${container.replace(/-/g, " ")}`;
}

function referenceInstructions(refs: ReferenceImageInput[]): string {
  if (refs.length === 0) return "";

  const lines = refs.map((r, i) => {
    const weight = r.weight ?? 0.7;
    const strength =
      weight >= 0.85 ? "strongly match" : weight >= 0.55 ? "use as guidance for" : "lightly reference";
    return `Image ${i + 1} (${r.role || "reference"}): ${strength} this for ${r.role || "overall feel"}`;
  });

  return `Reference images: ${lines.join("; ")}`;
}

export function normalizeForModeration(text: string): string {
  return text
    .toLowerCase()
    .replace(/[013457$@!]/g, (c) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "$": "s", "@": "a", "!": "i" })[c] ?? c)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildPrompt(input: BuildPromptInput): BuiltPrompt {
  const preset = STYLE_PRESETS.find((p) => p.id === input.stylePresetId);
  const styleFragment = preset?.promptFragment ?? "";
  const styleNegative = preset?.negativeFragment ?? "";

  const realism = realismPhrase(input.realism);
  const colorName = nearestNamedColor(input.hue, input.saturation, input.lightness);
  const colorPhrase = `${colorInfluencePhrase(input.colorInfluence)} ${colorName}`;
  const composition = compositionRules(input.shape, input.container, input.volume);
  const refs = referenceInstructions(input.referenceImages);

  const parts = [
    input.userText.trim(),
    styleFragment,
    realism,
    colorPhrase,
    composition,
    refs,
  ].filter(Boolean);

  const prompt = parts.join(". ").replace(/\s+\./g, ".").replace(/\.\.+/g, ".");
  const negativePrompt = [GLOBAL_NEGATIVE, styleNegative].filter(Boolean).join(", ");

  return {
    prompt,
    negativePrompt,
    debug: { realism, colorName, colorPhrase, composition, refs },
  };
}
