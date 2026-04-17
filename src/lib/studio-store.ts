import { create } from "zustand";

export type StickerShape = "rectangle" | "oval" | "circle" | "diecut" | "square" | "rounded";

export type TextLayer = {
    id: string;
    text: string;
    font: string;
    color: string;
    size: number; // px
    x: number; // 0-100 %
    y: number;
};

export type StudioState = {
    // Step 0
    container: string | null;
    volume: string | null;
    // Step 1
    prompt: string;
    stylePreset: string | null;
    imageUrl: string | null;
    // Step 2
    shape: StickerShape;
    size: string;
    textLayers: TextLayer[];
    whiteBorder: boolean;

    setContainer: (c: string | null) => void;
    setVolume: (v: string | null) => void;
    setPrompt: (v: string) => void;
    setStylePreset: (v: string | null) => void;
    setImage: (url: string | null) => void;
    setShape: (s: StickerShape) => void;
    setSize: (v: string) => void;
    addTextLayer: () => void;
    updateTextLayer: (id: string, patch: Partial<TextLayer>) => void;
    removeTextLayer: (id: string) => void;
    setWhiteBorder: (v: boolean) => void;
    reset: () => void;
};

const initial = {
    container: null as string | null,
    volume: null as string | null,
    prompt: "",
    stylePreset: null as string | null,
    imageUrl: null as string | null,
    shape: "rectangle" as StickerShape,
    size: "medium",
    textLayers: [] as TextLayer[],
    whiteBorder: true,
};

export const useStudio = create<StudioState>((set) => ({
    ...initial,
    setContainer: (c) => set({ container: c }),
    setVolume: (v) => set({ volume: v }),
    setPrompt: (v) => set({ prompt: v }),
    setStylePreset: (v) => set({ stylePreset: v }),
    setImage: (url) => set({ imageUrl: url }),
    setShape: (s) => set({ shape: s }),
    setSize: (v) => set({ size: v }),
    addTextLayer: () =>
        set((s) => {
            if (s.textLayers.length >= 2) return s;
            const layer: TextLayer = {
                id: crypto.randomUUID(),
                text: s.textLayers.length === 0 ? "Sarah & Tom" : "June 14, 2026",
                font: "Inter",
                color: "#1f2a24",
                size: 22,
                x: 50,
                y: s.textLayers.length === 0 ? 78 : 88,
            };
            return { textLayers: [...s.textLayers, layer] };
        }),
    updateTextLayer: (id, patch) =>
        set((s) => ({
            textLayers: s.textLayers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),
    removeTextLayer: (id) =>
        set((s) => ({ textLayers: s.textLayers.filter((l) => l.id !== id) })),
    setWhiteBorder: (v) => set({ whiteBorder: v }),
    reset: () => set({ ...initial }),
}));

export const CONTAINER_CHOICES = [
  { id: "wine",      label: "Wine bottle",    emoji: "🍷", tagline: "Classic still wine" },
  { id: "champagne", label: "Champagne",      emoji: "🥂", tagline: "Sparkling & celebratory" },
  { id: "beer",      label: "Beer bottle",    emoji: "🍺", tagline: "Craft & lager" },
  { id: "spirits",   label: "Spirits bottle", emoji: "🥃", tagline: "Whiskey, gin, vodka" },
  { id: "can",       label: "Can",            emoji: "🥤", tagline: "Soda, seltzer, beer" },
  { id: "growler",   label: "Growler",        emoji: "🍶", tagline: "Refillable craft" },
];

export const BOTTLE_VOLUMES: Record<string, string[]> = {
  wine:      ["375ml", "500ml", "750ml", "1.5L"],
  champagne: ["200ml", "375ml", "750ml", "1.5L"],
  beer:      ["330ml", "500ml", "660ml"],
  spirits:   ["200ml", "500ml", "700ml", "1L"],
  can:       ["250ml", "330ml", "440ml", "500ml"],
  growler:   ["1L", "2L", "32oz", "64oz"],
};

export const SHAPE_CHOICES: { id: StickerShape; label: string; description: string }[] = [
  { id: "rectangle", label: "Rectangle", description: "Classic front label" },
  { id: "oval",      label: "Oval",     description: "Elegant & traditional" },
  { id: "circle",    label: "Circle",   description: "Neck seal / cap" },
  { id: "diecut",    label: "Die-cut",  description: "Custom contour" },
  { id: "square",    label: "Square",   description: "Modern square label" },
  { id: "rounded",   label: "Rounded",  description: "Soft rounded corners" },
];

export const SIZE_CHOICES = [
  { id: "small",  label: "Small",  hint: "2 in" },
  { id: "medium", label: "Medium", hint: "3 in" },
  { id: "large",  label: "Large",  hint: "4 in" },
  { id: "xl",     label: "XL",     hint: "5 in" },
] as const;

export const STYLE_PRESETS = [
  { id: "fine-wine",       label: "Fine Wine",       description: "Botanical engraving — classical, refined" },
  { id: "craft-beer",      label: "Craft Beer",      description: "Bold illustrative — punchy, characterful" },
  { id: "natural-wine",    label: "Natural Wine",    description: "Soft watercolour — organic, handmade" },
  { id: "premium-spirits", label: "Premium Spirits", description: "Heritage engraving — deep, distinguished" },
  { id: "sparkling",       label: "Sparkling",       description: "Festive & luminous — gold, celebratory" },
  { id: "modern-label",    label: "Modern Label",    description: "Clean flat design — minimal, contemporary" },
];

export const FONT_CHOICES = [
    "Inter",
    "Georgia",
    "Playfair Display",
    "Courier New",
    "Verdana",
    "Brush Script MT",
];

export const STEPS = [
  { id: 1, slug: "bottle",    label: "Bottle",    path: "/studio/bottle" },
  { id: 2, slug: "create",    label: "Create",    path: "/studio/create" },
  { id: 3, slug: "customize", label: "Customize", path: "/studio/customize" },
  { id: 4, slug: "preview",   label: "Preview",   path: "/studio/preview" },
  { id: 5, slug: "checkout",  label: "Download",  path: "/studio/checkout" },
] as const;
