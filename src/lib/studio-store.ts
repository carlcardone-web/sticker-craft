import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type StickerShape = "rectangle" | "oval" | "circle" | "diecut" | "square" | "rounded";
export type SliderKey = "realism" | "hue" | "saturation" | "lightness" | "colorInfluence";

export type TextLayerReference = { id: string; url: string; role: string };

export type TextLayer = {
  id: string;
  mode: "text" | "ai";
  text: string;
  font: string;
  color: string;
  size: number;
  x: number;
  y: number;
  aiPrompt?: string;
  aiImageUrl?: string | null;
  aiReferences?: TextLayerReference[];
  aiWidth?: number;
  rotation?: number;
};

export type ImageTransform = { scale: number; offsetX: number; offsetY: number };
export type ReferenceImage = { id: string; url: string; role: string; weight?: number };

export type GenerationParams = {
  userText: string;
  stylePresetId: string | null;
  shape: StickerShape;
  container: string;
  volume: string;
  referenceImages: ReferenceImage[];
  realism: number;
  hue: number;
  saturation: number;
  lightness: number;
  colorInfluence: number;
};

export type LastGeneration = {
  prompt: string;
  negativePrompt: string;
  seed: number;
  params: GenerationParams;
} | null;

export type CustomFont = {
  id: string;
  name: string;
  dataUrl: string;
  format: string;
};

export type StylePreset = {
  id: string;
  label: string;
  description: string;
  promptFragment: string;
  negativeFragment: string;
  defaultRealism?: number;
  defaultHue?: number;
  defaultSaturation?: number;
  defaultLightness?: number;
  defaultColorInfluence?: number;
};

export type StudioState = {
  container: string | null;
  volume: string | null;
  prompt: string;
  stylePreset: string | null;
  imageUrl: string | null;
  referenceImages: ReferenceImage[];
  shape: StickerShape;
  textLayers: TextLayer[];
  whiteBorder: boolean;
  imageTransform: ImageTransform;
  customFonts: CustomFont[];
  realism: number;
  hue: number;
  saturation: number;
  lightness: number;
  colorInfluence: number;
  sliderDirty: Record<SliderKey, boolean>;
  lockSeed: boolean;
  seed: number | null;
  lastGeneration: LastGeneration;
  setContainer: (c: string | null) => void;
  setVolume: (v: string | null) => void;
  setPrompt: (v: string) => void;
  setStylePreset: (v: string | null) => void;
  setImage: (url: string | null) => void;
  setShape: (s: StickerShape) => void;
  addTextLayer: () => void;
  updateTextLayer: (id: string, patch: Partial<TextLayer>) => void;
  removeTextLayer: (id: string) => void;
  setTextLayerAiImage: (id: string, url: string | null) => void;
  addTextLayerReference: (id: string, url: string, role?: string) => void;
  updateTextLayerReference: (id: string, refId: string, role: string) => void;
  removeTextLayerReference: (id: string, refId: string) => void;
  setWhiteBorder: (v: boolean) => void;
  setImageTransform: (patch: Partial<ImageTransform>) => void;
  resetImageTransform: () => void;
  addReferenceImage: (url: string, role?: string, weight?: number) => void;
  updateReferenceImageUrl: (id: string, url: string) => void;
  updateReferenceImageRole: (id: string, role: string) => void;
  updateReferenceImageWeight: (id: string, weight: number) => void;
  removeReferenceImage: (id: string) => void;
  clearReferenceImages: () => void;
  setSliderValue: (key: SliderKey, value: number, markDirty?: boolean) => void;
  resetSliderDirty: () => void;
  setLockSeed: (v: boolean) => void;
  setSeed: (seed: number | null) => void;
  issueSeed: (mode?: "fresh" | "reuse") => number;
  setLastGeneration: (generation: LastGeneration) => void;
  addCustomFont: (font: Omit<CustomFont, "id">) => string;
  removeCustomFont: (id: string) => void;
  reset: () => void;
};

const DEFAULT_TRANSFORM: ImageTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const MAX_REFERENCES = 3;
const DEFAULT_REFERENCE_WEIGHT = 0.7;
const MAX_IMAGE_SEED = 2_147_483_647;
export const MAX_REFERENCE_INLINE_BYTES = 4 * 1024 * 1024;
export const MAX_REFERENCE_TOTAL_BYTES = 6 * 1024 * 1024;
const DEFAULT_SLIDERS = {
  realism: 40,
  hue: 150,
  saturation: 25,
  lightness: 60,
  colorInfluence: 60,
} as const;
const DEFAULT_DIRTY: Record<SliderKey, boolean> = {
  realism: false,
  hue: false,
  saturation: false,
  lightness: false,
  colorInfluence: false,
};

function createSeed() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0] % (MAX_IMAGE_SEED + 1);
  }
  return Math.floor(Math.random() * (MAX_IMAGE_SEED + 1));
}

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function estimateReferencePayloadBytes(url: string): number {
  if (!url) return 0;
  if (!url.startsWith("data:")) return url.length;
  const commaIndex = url.indexOf(",");
  if (commaIndex === -1) return url.length;
  const meta = url.slice(0, commaIndex);
  const payload = url.slice(commaIndex + 1);
  if (meta.includes(";base64")) {
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }
  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).length;
  } catch {
    return payload.length;
  }
}

function presetSliderDefaults(presetId: string | null) {
  const preset = STYLE_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) return null;
  return {
    realism: preset.defaultRealism ?? DEFAULT_SLIDERS.realism,
    hue: preset.defaultHue ?? DEFAULT_SLIDERS.hue,
    saturation: preset.defaultSaturation ?? DEFAULT_SLIDERS.saturation,
    lightness: preset.defaultLightness ?? DEFAULT_SLIDERS.lightness,
    colorInfluence: preset.defaultColorInfluence ?? DEFAULT_SLIDERS.colorInfluence,
  };
}

const initial = {
  container: null as string | null,
  volume: null as string | null,
  prompt: "",
  stylePreset: null as string | null,
  imageUrl: null as string | null,
  referenceImages: [] as ReferenceImage[],
  shape: "rectangle" as StickerShape,
  textLayers: [] as TextLayer[],
  whiteBorder: true,
  imageTransform: { ...DEFAULT_TRANSFORM },
  customFonts: [] as CustomFont[],
  realism: DEFAULT_SLIDERS.realism,
  hue: DEFAULT_SLIDERS.hue,
  saturation: DEFAULT_SLIDERS.saturation,
  lightness: DEFAULT_SLIDERS.lightness,
  colorInfluence: DEFAULT_SLIDERS.colorInfluence,
  sliderDirty: { ...DEFAULT_DIRTY },
  lockSeed: false,
  seed: null as number | null,
  lastGeneration: null as LastGeneration,
};

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      ...initial,
      setContainer: (c) =>
        set((s) => {
          if (c === s.container) return { container: c };
          const valid = c ? BOTTLE_VOLUMES[c] ?? [] : [];
          const nextVolume = s.volume && valid.includes(s.volume) ? s.volume : null;
          return { container: c, volume: nextVolume };
        }),
      setVolume: (v) => set({ volume: v }),
      setPrompt: (v) => set({ prompt: v }),
      setStylePreset: (v) =>
        set((s) => {
          const next: Partial<StudioState> = { stylePreset: v };
          const defaults = presetSliderDefaults(v);
          if (!defaults) return next;
          (Object.keys(defaults) as SliderKey[]).forEach((key) => {
            if (!s.sliderDirty[key]) {
              next[key] = defaults[key] as never;
            }
          });
          return next;
        }),
      setImage: (url) => set({ imageUrl: url, imageTransform: { ...DEFAULT_TRANSFORM } }),
      setImageTransform: (patch) => set((s) => ({ imageTransform: { ...s.imageTransform, ...patch } })),
      resetImageTransform: () => set({ imageTransform: { ...DEFAULT_TRANSFORM } }),
      setShape: (s) => set({ shape: s }),
      addTextLayer: () =>
        set((s) => {
          if (s.textLayers.length >= 2) return s;
          const layer: TextLayer = {
            id: createId(),
            mode: "text",
            text: s.textLayers.length === 0 ? "Sarah & Tom" : "June 14, 2026",
            font: "Inter",
            color: "#1f2a24",
            size: 22,
            x: 50,
            y: s.textLayers.length === 0 ? 78 : 88,
            aiPrompt: "",
            aiImageUrl: null,
            aiReferences: [],
            aiWidth: 60,
            rotation: 0,
          };
          return { textLayers: [...s.textLayers, layer] };
        }),
      setTextLayerAiImage: (id, url) =>
        set((s) => ({
          textLayers: s.textLayers.map((l) => (l.id === id ? { ...l, aiImageUrl: url } : l)),
        })),
      addTextLayerReference: (id, url, role = "Font style") =>
        set((s) => ({
          textLayers: s.textLayers.map((l) => {
            if (l.id !== id) return l;
            const refs = l.aiReferences ?? [];
            if (refs.length >= 2) return l;
            return { ...l, aiReferences: [...refs, { id: createId(), url, role }] };
          }),
        })),
      updateTextLayerReference: (id, refId, role) =>
        set((s) => ({
          textLayers: s.textLayers.map((l) =>
            l.id === id
              ? { ...l, aiReferences: (l.aiReferences ?? []).map((r) => (r.id === refId ? { ...r, role } : r)) }
              : l,
          ),
        })),
      removeTextLayerReference: (id, refId) =>
        set((s) => ({
          textLayers: s.textLayers.map((l) =>
            l.id === id ? { ...l, aiReferences: (l.aiReferences ?? []).filter((r) => r.id !== refId) } : l,
          ),
        })),
      updateTextLayer: (id, patch) =>
        set((s) => ({ textLayers: s.textLayers.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      removeTextLayer: (id) => set((s) => ({ textLayers: s.textLayers.filter((l) => l.id !== id) })),
      setWhiteBorder: (v) => set({ whiteBorder: v }),
      addReferenceImage: (url, role = "Subject", weight = DEFAULT_REFERENCE_WEIGHT) =>
        set((s) => {
          if (s.referenceImages.length >= MAX_REFERENCES) return s;
          return { referenceImages: [...s.referenceImages, { id: createId(), url, role, weight }] };
        }),
      updateReferenceImageUrl: (id, url) =>
        set((s) => ({
          referenceImages: s.referenceImages.map((r) => (r.id === id ? { ...r, url } : r)),
        })),
      updateReferenceImageRole: (id, role) =>
        set((s) => ({
          referenceImages: s.referenceImages.map((r) => (r.id === id ? { ...r, role } : r)),
        })),
      updateReferenceImageWeight: (id, weight) =>
        set((s) => ({
          referenceImages: s.referenceImages.map((r) => (r.id === id ? { ...r, weight } : r)),
        })),
      removeReferenceImage: (id) =>
        set((s) => ({ referenceImages: s.referenceImages.filter((r) => r.id !== id) })),
      clearReferenceImages: () => set({ referenceImages: [] }),
      setSliderValue: (key, value, markDirty = true) =>
        set((s) => ({
          [key]: value,
          sliderDirty: markDirty ? { ...s.sliderDirty, [key]: true } : s.sliderDirty,
        } as Partial<StudioState>)),
      resetSliderDirty: () => set({ sliderDirty: { ...DEFAULT_DIRTY } }),
      setLockSeed: (v) => set({ lockSeed: v }),
      setSeed: (seed) => set({ seed }),
      issueSeed: (mode = "fresh") => {
        const state = get();
        if (mode === "reuse" && state.seed != null) {
          return state.seed;
        }
        if (mode === "reuse" && state.lastGeneration?.seed != null) {
          set({ seed: state.lastGeneration.seed });
          return state.lastGeneration.seed;
        }
        if (mode === "fresh" && state.lockSeed && state.seed != null) {
          return state.seed;
        }
        const seed = createSeed();
        set({ seed });
        return seed;
      },
      setLastGeneration: (generation) => set({ lastGeneration: generation }),
      addCustomFont: (font) => {
        const id = createId();
        set((s) => ({ customFonts: [...s.customFonts, { ...font, id }] }));
        return id;
      },
      removeCustomFont: (id) => set((s) => ({ customFonts: s.customFonts.filter((f) => f.id !== id) })),
      reset: () =>
        set({
          ...initial,
          imageTransform: { ...DEFAULT_TRANSFORM },
          sliderDirty: { ...DEFAULT_DIRTY },
        }),
    }),
    {
      name: "lovable-studio-v2",
      version: 2,
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") return window.localStorage;
        const noop: Storage = {
          length: 0,
          clear: () => {},
          getItem: () => null,
          key: () => null,
          removeItem: () => {},
          setItem: () => {},
        };
        return noop;
      }),
      partialize: (s) => ({
        container: s.container,
        volume: s.volume,
        prompt: s.prompt,
        stylePreset: s.stylePreset,
        imageUrl: s.imageUrl,
        referenceImages: s.referenceImages,
        shape: s.shape,
        textLayers: s.textLayers,
        whiteBorder: s.whiteBorder,
        imageTransform: s.imageTransform,
        customFonts: s.customFonts,
        realism: s.realism,
        hue: s.hue,
        saturation: s.saturation,
        lightness: s.lightness,
        colorInfluence: s.colorInfluence,
        sliderDirty: s.sliderDirty,
        lockSeed: s.lockSeed,
        seed: s.seed,
        lastGeneration: s.lastGeneration,
      }),
    },
  ),
);

export const MAX_REFERENCE_IMAGES = MAX_REFERENCES;

export const CONTAINER_CHOICES = [
  { id: "wine", label: "Wine bottle", emoji: "🍷", tagline: "Classic still wine" },
  { id: "champagne", label: "Champagne", emoji: "🥂", tagline: "Sparkling & celebratory" },
  { id: "beer", label: "Beer bottle", emoji: "🍺", tagline: "Craft & lager" },
  { id: "spirits", label: "Spirits bottle", emoji: "🥃", tagline: "Whiskey, gin, vodka" },
  { id: "can", label: "Can", emoji: "🥤", tagline: "Soda, seltzer, beer" },
  { id: "growler", label: "Growler", emoji: "🍶", tagline: "Refillable craft" },
];

export const BOTTLE_VOLUMES: Record<string, string[]> = {
  wine: ["375ml", "500ml", "750ml", "1.5L"],
  champagne: ["200ml", "375ml", "750ml", "1.5L"],
  beer: ["330ml", "500ml", "660ml"],
  spirits: ["200ml", "500ml", "700ml", "1L"],
  can: ["250ml", "330ml", "440ml", "500ml"],
  growler: ["1L", "2L", "32oz", "64oz"],
};

export const SHAPE_CHOICES: { id: StickerShape; label: string; description: string }[] = [
  { id: "rectangle", label: "Rectangle", description: "Classic front label" },
  { id: "oval", label: "Oval", description: "Elegant & traditional" },
  { id: "circle", label: "Circle", description: "Neck seal / cap" },
  { id: "diecut", label: "Die-cut", description: "Custom contour" },
  { id: "square", label: "Square", description: "Modern square label" },
  { id: "rounded", label: "Rounded", description: "Soft rounded corners" },
];

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "fine-wine",
    label: "Fine Wine",
    description: "Botanical engraving — classical, refined",
    promptFragment: "classical engraved wine-label illustration, intricate botanical linework, refined ornamental balance, premium printed finish",
    negativeFragment: "no cartoon styling, no loud neon palette, no grunge textures",
    defaultRealism: 68,
    defaultHue: 350,
    defaultSaturation: 35,
    defaultLightness: 70,
    defaultColorInfluence: 58,
  },
  {
    id: "craft-beer",
    label: "Craft Beer",
    description: "Bold illustrative — punchy, characterful",
    promptFragment: "bold craft beverage illustration, punchy silhouette, expressive shapes, poster-like clarity, confident contrast",
    negativeFragment: "no dainty filigree, no overly formal composition",
    defaultRealism: 34,
    defaultHue: 18,
    defaultSaturation: 68,
    defaultLightness: 56,
    defaultColorInfluence: 74,
  },
  {
    id: "natural-wine",
    label: "Natural Wine",
    description: "Soft watercolour — organic, handmade",
    promptFragment: "organic watercolor illustration, soft bleeding edges, handmade paper feel, poetic and airy composition",
    negativeFragment: "no sterile vector lines, no chrome or metallic effects",
    defaultRealism: 42,
    defaultHue: 150,
    defaultSaturation: 24,
    defaultLightness: 64,
    defaultColorInfluence: 60,
  },
  {
    id: "premium-spirits",
    label: "Premium Spirits",
    description: "Heritage engraving — deep, distinguished",
    promptFragment: "heritage spirits label illustration, distinguished engraved detailing, dramatic contrast, luxurious materials, collector-grade finish",
    negativeFragment: "no playful doodles, no pastel palette",
    defaultRealism: 78,
    defaultHue: 25,
    defaultSaturation: 42,
    defaultLightness: 30,
    defaultColorInfluence: 64,
  },
  {
    id: "sparkling",
    label: "Sparkling",
    description: "Festive & luminous — gold, celebratory",
    promptFragment: "luminous celebratory illustration, elegant sparkle cues, festive premium finish, airy glamour",
    negativeFragment: "no flat muddy palette, no gritty textures",
    defaultRealism: 58,
    defaultHue: 45,
    defaultSaturation: 55,
    defaultLightness: 76,
    defaultColorInfluence: 70,
  },
  {
    id: "modern-label",
    label: "Modern Label",
    description: "Clean flat design — minimal, contemporary",
    promptFragment: "clean contemporary label illustration, minimal geometry, crisp editorial spacing, polished flat design sensibility",
    negativeFragment: "no ornate flourishes, no cluttered collage look",
    defaultRealism: 18,
    defaultHue: 215,
    defaultSaturation: 18,
    defaultLightness: 82,
    defaultColorInfluence: 52,
  },
];

export const STEPS = [
  { id: 1, slug: "bottle", label: "Bottle", path: "/studio/bottle" },
  { id: 2, slug: "create", label: "Create", path: "/studio/create" },
  { id: 3, slug: "preview", label: "Preview", path: "/studio/preview" },
  { id: 4, slug: "checkout", label: "Download", path: "/studio/checkout" },
] as const;

export type LabelDims = {
  w: number;
  h: number;
  kind: "front" | "wrap";
};

export const LABEL_DIMENSIONS: Record<string, Record<string, LabelDims>> = {
  wine: {
    "375ml": { w: 7, h: 9, kind: "front" },
    "500ml": { w: 8, h: 10, kind: "front" },
    "750ml": { w: 9, h: 11, kind: "front" },
    "1.5L": { w: 11, h: 13.5, kind: "front" },
  },
  champagne: {
    "200ml": { w: 5.5, h: 8, kind: "front" },
    "375ml": { w: 7, h: 9, kind: "front" },
    "750ml": { w: 10.5, h: 13.5, kind: "front" },
    "1.5L": { w: 13.5, h: 16.5, kind: "front" },
  },
  beer: {
    "330ml": { w: 7.5, h: 9, kind: "front" },
    "500ml": { w: 9, h: 11, kind: "front" },
    "660ml": { w: 10, h: 12.5, kind: "front" },
  },
  spirits: {
    "200ml": { w: 5.5, h: 7, kind: "front" },
    "500ml": { w: 8, h: 10.5, kind: "front" },
    "700ml": { w: 9, h: 11.5, kind: "front" },
    "1L": { w: 10, h: 13.5, kind: "front" },
  },
  can: {
    "250ml": { w: 17.75, h: 9.5, kind: "wrap" },
    "330ml": { w: 21, h: 11.5, kind: "wrap" },
    "440ml": { w: 22.75, h: 12.75, kind: "wrap" },
    "500ml": { w: 24, h: 14, kind: "wrap" },
  },
  growler: {
    "1L": { w: 10, h: 11.5, kind: "front" },
    "2L": { w: 12.5, h: 15, kind: "front" },
    "32oz": { w: 10, h: 12.5, kind: "front" },
    "64oz": { w: 12.5, h: 16, kind: "front" },
  },
};

export function getLabelDimensions(container?: string | null, volume?: string | null): LabelDims | null {
  if (!container || !volume) return null;
  return LABEL_DIMENSIONS[container]?.[volume] ?? null;
}
