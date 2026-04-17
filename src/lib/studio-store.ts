import { create } from "zustand";

export type StickerShape =
  | "circle"
  | "square"
  | "rectangle"
  | "rounded"
  | "oval"
  | "diecut";

export type TextLayer = {
  id: string;
  text: string;
  font: string;
  color: string;
  size: number; // px
  x: number; // 0-100 %
  y: number;
};

export type Provider = "lovable" | "replicate";
export type Quality = "fast" | "high";

export type StudioState = {
  // Step 1
  prompt: string;
  stylePreset: string | null;
  imageUrl: string | null; // generated/uploaded artwork
  provider: Provider;
  quality: Quality;
  // Step 2
  shape: StickerShape;
  textLayers: TextLayer[];
  whiteBorder: boolean;
  // Step 3
  container: string;

  setPrompt: (v: string) => void;
  setStylePreset: (v: string | null) => void;
  setImage: (url: string | null) => void;
  setProvider: (p: Provider) => void;
  setQuality: (q: Quality) => void;
  setShape: (s: StickerShape) => void;
  addTextLayer: () => void;
  updateTextLayer: (id: string, patch: Partial<TextLayer>) => void;
  removeTextLayer: (id: string) => void;
  setWhiteBorder: (v: boolean) => void;
  setContainer: (c: string) => void;
  reset: () => void;
};

const initial = {
  prompt: "",
  stylePreset: null as string | null,
  imageUrl: null as string | null,
  provider: "lovable" as Provider,
  quality: "fast" as Quality,
  shape: "circle" as StickerShape,
  textLayers: [] as TextLayer[],
  whiteBorder: true,
  container: "wine",
};

export const useStudio = create<StudioState>((set) => ({
  ...initial,
  setPrompt: (v) => set({ prompt: v }),
  setStylePreset: (v) => set({ stylePreset: v }),
  setImage: (url) => set({ imageUrl: url }),
  setProvider: (p) => set({ provider: p }),
  setQuality: (q) => set({ quality: q }),
  setShape: (s) => set({ shape: s }),
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
  setContainer: (c) => set({ container: c }),
  reset: () => set({ ...initial }),
}));

export const STYLE_PRESETS = [
  { id: "watercolor", label: "Watercolor" },
  { id: "lineart", label: "Line art" },
  { id: "vintage", label: "Vintage label" },
  { id: "flat", label: "Modern flat" },
  { id: "photographic", label: "Photographic" },
  { id: "cartoon", label: "Cartoon" },
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
  { id: 1, slug: "create", label: "Create", path: "/studio/create" },
  { id: 2, slug: "customize", label: "Customize", path: "/studio/customize" },
  { id: 3, slug: "preview", label: "Preview", path: "/studio/preview" },
  { id: 4, slug: "checkout", label: "Download", path: "/studio/checkout" },
] as const;
