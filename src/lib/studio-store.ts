import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type StickerShape = "rectangle" | "oval" | "circle" | "diecut" | "square" | "rounded";

export type TextLayerReference = { id: string; url: string; role: string };

export type TextLayer = {
    id: string;
    mode: "text" | "ai";
    text: string;
    font: string;
    color: string;
    size: number; // px
    x: number; // 0-100 %
    y: number;
    // AI-mode fields
    aiPrompt?: string;
    aiImageUrl?: string | null;
    aiReferences?: TextLayerReference[];
    aiWidth?: number; // % of sticker width
    rotation?: number; // degrees
};

export type ImageTransform = { scale: number; offsetX: number; offsetY: number };

export type ReferenceImage = { id: string; url: string; role: string };

export type CustomFont = {
    id: string;
    name: string;
    dataUrl: string;
    /** CSS font format hint, e.g. "truetype", "opentype", "woff", "woff2" */
    format: string;
};

export type StudioState = {
    // Step 0
    container: string | null;
    volume: string | null;
    // Step 1
    prompt: string;
    stylePreset: string | null;
    imageUrl: string | null;
    referenceImages: ReferenceImage[];
    // Step 2
    shape: StickerShape;
    textLayers: TextLayer[];
    whiteBorder: boolean;
    imageTransform: ImageTransform;
    customFonts: CustomFont[];

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
    addReferenceImage: (url: string, role?: string) => void;
    updateReferenceImageRole: (id: string, role: string) => void;
    removeReferenceImage: (id: string) => void;
    clearReferenceImages: () => void;
    addCustomFont: (font: Omit<CustomFont, "id">) => string;
    removeCustomFont: (id: string) => void;
    reset: () => void;
};

const DEFAULT_TRANSFORM: ImageTransform = { scale: 1, offsetX: 0, offsetY: 0 };

const MAX_REFERENCES = 3;

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
};

export const useStudio = create<StudioState>()(
    persist(
        (set) => ({
            ...initial,
            setContainer: (c) =>
                set((s) => {
                    if (c === s.container) return { container: c };
                    // Reset volume if it's no longer valid for the new container.
                    const valid = c ? BOTTLE_VOLUMES[c] ?? [] : [];
                    const nextVolume = s.volume && valid.includes(s.volume) ? s.volume : null;
                    return { container: c, volume: nextVolume };
                }),
            setVolume: (v) => set({ volume: v }),
            setPrompt: (v) => set({ prompt: v }),
            setStylePreset: (v) => set({ stylePreset: v }),
            setImage: (url) => set({ imageUrl: url, imageTransform: { ...DEFAULT_TRANSFORM } }),
            setImageTransform: (patch) =>
                set((s) => ({ imageTransform: { ...s.imageTransform, ...patch } })),
            resetImageTransform: () => set({ imageTransform: { ...DEFAULT_TRANSFORM } }),
            setShape: (s) => set({ shape: s }),
    addTextLayer: () =>
                set((s) => {
                    if (s.textLayers.length >= 2) return s;
                    const uid = () =>
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                            ? crypto.randomUUID()
                            : `${Date.now()}-${Math.random()}`;
                    const layer: TextLayer = {
                        id: uid(),
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
            setTextLayerAiImage: (id: string, url: string | null) =>
                set((s) => ({
                    textLayers: s.textLayers.map((l) => (l.id === id ? { ...l, aiImageUrl: url } : l)),
                })),
            addTextLayerReference: (id: string, url: string, role = "Font style") =>
                set((s) => ({
                    textLayers: s.textLayers.map((l) => {
                        if (l.id !== id) return l;
                        const refs = l.aiReferences ?? [];
                        if (refs.length >= 2) return l;
                        const refId =
                            typeof crypto !== "undefined" && "randomUUID" in crypto
                                ? crypto.randomUUID()
                                : `${Date.now()}-${Math.random()}`;
                        return { ...l, aiReferences: [...refs, { id: refId, url, role }] };
                    }),
                })),
            updateTextLayerReference: (id: string, refId: string, role: string) =>
                set((s) => ({
                    textLayers: s.textLayers.map((l) =>
                        l.id === id
                            ? {
                                  ...l,
                                  aiReferences: (l.aiReferences ?? []).map((r) =>
                                      r.id === refId ? { ...r, role } : r,
                                  ),
                              }
                            : l,
                    ),
                })),
            removeTextLayerReference: (id: string, refId: string) =>
                set((s) => ({
                    textLayers: s.textLayers.map((l) =>
                        l.id === id
                            ? { ...l, aiReferences: (l.aiReferences ?? []).filter((r) => r.id !== refId) }
                            : l,
                    ),
                })),
            updateTextLayer: (id, patch) =>
                set((s) => ({
                    textLayers: s.textLayers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
                })),
            removeTextLayer: (id) =>
                set((s) => ({ textLayers: s.textLayers.filter((l) => l.id !== id) })),
            setWhiteBorder: (v) => set({ whiteBorder: v }),
            addReferenceImage: (url, role = "Subject") =>
                set((s) => {
                    if (s.referenceImages.length >= MAX_REFERENCES) return s;
                    const id =
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                            ? crypto.randomUUID()
                            : `${Date.now()}-${Math.random()}`;
                    return { referenceImages: [...s.referenceImages, { id, url, role }] };
                }),
            updateReferenceImageRole: (id, role) =>
                set((s) => ({
                    referenceImages: s.referenceImages.map((r) =>
                        r.id === id ? { ...r, role } : r,
                    ),
                })),
            removeReferenceImage: (id) =>
                set((s) => ({ referenceImages: s.referenceImages.filter((r) => r.id !== id) })),
            clearReferenceImages: () => set({ referenceImages: [] }),
            addCustomFont: (font) => {
                const id =
                    typeof crypto !== "undefined" && "randomUUID" in crypto
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random()}`;
                set((s) => ({ customFonts: [...s.customFonts, { ...font, id }] }));
                return id;
            },
            removeCustomFont: (id) =>
                set((s) => ({ customFonts: s.customFonts.filter((f) => f.id !== id) })),
            reset: () => set({ ...initial, imageTransform: { ...DEFAULT_TRANSFORM } }),
        }),
        {
            name: "lovable-studio-v1",
            version: 1,
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
            }),
        },
    ),
);

export const MAX_REFERENCE_IMAGES = MAX_REFERENCES;

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

/**
 * Real-world label dimensions in centimetres, derived from the midpoint of
 * typical commercial label sizing for each container × volume combination.
 * This is the single source of truth used by both the live preview frame
 * (aspect ratio) and the AI generation prompt (composition target).
 */
export type LabelDims = {
  w: number; // cm
  h: number; // cm
  kind: "front" | "wrap";
};

export const LABEL_DIMENSIONS: Record<string, Record<string, LabelDims>> = {
  wine: {
    "375ml": { w: 7,  h: 9,  kind: "front" },
    "500ml": { w: 8,  h: 10, kind: "front" },
    "750ml": { w: 9,  h: 11, kind: "front" },
    "1.5L":  { w: 11, h: 13.5, kind: "front" },
  },
  champagne: {
    "200ml": { w: 5.5, h: 8,    kind: "front" },
    "375ml": { w: 7,   h: 9,    kind: "front" },
    "750ml": { w: 10.5, h: 13.5, kind: "front" },
    "1.5L":  { w: 13.5, h: 16.5, kind: "front" },
  },
  beer: {
    "330ml": { w: 7.5, h: 9,    kind: "front" },
    "500ml": { w: 9,   h: 11,   kind: "front" },
    "660ml": { w: 10,  h: 12.5, kind: "front" },
  },
  spirits: {
    "200ml": { w: 5.5, h: 7,    kind: "front" },
    "500ml": { w: 8,   h: 10.5, kind: "front" },
    "700ml": { w: 9,   h: 11.5, kind: "front" },
    "1L":    { w: 10,  h: 13.5, kind: "front" },
  },
  can: {
    "250ml": { w: 17.75, h: 9.5,  kind: "wrap" },
    "330ml": { w: 21,    h: 11.5, kind: "wrap" },
    "440ml": { w: 22.75, h: 12.75, kind: "wrap" },
    "500ml": { w: 24,    h: 14,   kind: "wrap" },
  },
  growler: {
    "1L":    { w: 10, h: 11.5, kind: "front" },
    "2L":    { w: 12.5, h: 15, kind: "front" },
    "32oz":  { w: 10, h: 12.5, kind: "front" },
    "64oz":  { w: 12.5, h: 16, kind: "front" },
  },
};

export function getLabelDimensions(
  container?: string | null,
  volume?: string | null,
): LabelDims | null {
  if (!container || !volume) return null;
  return LABEL_DIMENSIONS[container]?.[volume] ?? null;
}
