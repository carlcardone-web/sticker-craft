import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { MentionTextarea } from "@/components/studio/MentionTextarea";
import { ContainerPreviewScene, getLabelCaption } from "@/components/studio/ContainerPreviewScene";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  CONTAINER_CHOICES,
  MAX_REFERENCE_INLINE_BYTES,
  MAX_REFERENCE_TOTAL_BYTES,
  STYLE_PRESETS,
  estimateReferencePayloadBytes,
  useStudio,
  type GenerationParams,
  type ReferenceImage,
  type SliderKey,
  type StickerShape,
  type TextLayer,
} from "@/lib/studio-store";
import { buildPrompt, nearestNamedColor, normalizeForModeration } from "@/lib/prompt-builder";
import { FONT_LIBRARY, ensureFontLoaded, detectFontFormat, getFontFamilyCSS, type FontCategory } from "@/lib/fonts";
import { generateSticker, getGenerationStatus } from "@/server/generate-sticker";
import { resolveTextLayer } from "@/server/resolve-text-layer";
import { uploadReferenceImage } from "@/server/upload-reference.functions";
import {
  ArrowRight,
  Circle,
  HelpCircle,
  ChevronRight,
  ImagePlus,
  Plus,
  RectangleHorizontal,
  RefreshCw,
  Sparkles,
  Square,
  ShieldAlert,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";

const BLOCKLIST = [
  "disney",
  "marvel",
  "pokemon",
  "mickey",
  "elsa",
  "spider-man",
  "spiderman",
  "batman",
  "superman",
  "harry potter",
  "star wars",
  "nike logo",
  "coca cola",
].map(normalizeForModeration);

const MAX_PROMPT_LENGTH = 300;
const PROMPT_WARNING_LENGTH = 250;
const MAX_REFS = 3;
const MAX_REFERENCE_FILE_SIZE = 6 * 1024 * 1024;
const ROLE_PRESETS = ["Subject", "Background", "Color palette", "Style", "Pose", "Mood"];
const CATEGORY_ORDER: FontCategory[] = ["Sans", "Serif", "Script", "Display", "Mono"];

type Template = {
  occasion: string;
  title: string;
  color: string;
  prompt: string;
  styleId: string;
  shape: StickerShape;
};

const TEMPLATES: Template[] = [
  {
    occasion: "Wedding",
    title: "Eucalyptus monogram",
    color: "linear-gradient(135deg, oklch(0.86 0.04 150), oklch(0.92 0.02 120))",
    prompt: "A delicate wreath of eucalyptus leaves and tiny white wildflowers framing an elegant monogram, soft watercolor on cream background, airy and romantic",
    styleId: "natural-wine",
    shape: "circle",
  },
  {
    occasion: "Wedding",
    title: "Gold botanical",
    color: "linear-gradient(135deg, oklch(0.92 0.05 85), oklch(0.86 0.04 70))",
    prompt: "An ornate botanical border in warm gold leaf with classical engraved leaves and small berries, refined and timeless, ivory background",
    styleId: "fine-wine",
    shape: "oval",
  },
  {
    occasion: "Birthday",
    title: "Confetti pop",
    color: "linear-gradient(135deg, oklch(0.88 0.08 30), oklch(0.9 0.07 55))",
    prompt: "Joyful scattered confetti and streamers in coral, peach and gold, playful hand-drawn shapes on a warm cream background",
    styleId: "craft-beer",
    shape: "square",
  },
  {
    occasion: "Birthday",
    title: "Pastel balloons",
    color: "linear-gradient(135deg, oklch(0.9 0.05 320), oklch(0.92 0.04 200))",
    prompt: "A cheerful cluster of pastel pink, mint and sky-blue balloons with delicate strings, soft flat illustration style, white background",
    styleId: "modern-label",
    shape: "square",
  },
  {
    occasion: "Baby Shower",
    title: "Cloud nine",
    color: "linear-gradient(135deg, oklch(0.95 0.02 220), oklch(0.93 0.03 200))",
    prompt: "Fluffy soft clouds with tiny stars in a dreamy pale blue sky, gentle watercolor wash, calm and tender",
    styleId: "natural-wine",
    shape: "rounded",
  },
  {
    occasion: "Baby Shower",
    title: "Tiny moon",
    color: "linear-gradient(135deg, oklch(0.92 0.03 260), oklch(0.88 0.04 280))",
    prompt: "A sleeping crescent moon with a single twinkling star, minimal line illustration in soft lavender, peaceful nursery feel",
    styleId: "modern-label",
    shape: "circle",
  },
  {
    occasion: "Housewarming",
    title: "Welcome home",
    color: "linear-gradient(135deg, oklch(0.9 0.04 60), oklch(0.88 0.05 40))",
    prompt: "A cozy little house with warm lit windows surrounded by leafy plants and a small welcome banner, friendly hand-drawn illustration",
    styleId: "craft-beer",
    shape: "rounded",
  },
  {
    occasion: "Holiday",
    title: "Pine & cinnamon",
    color: "linear-gradient(135deg, oklch(0.85 0.06 150), oklch(0.8 0.07 30))",
    prompt: "A festive wreath of pine sprigs, cinnamon sticks, and red berries tied with a rustic ribbon, warm botanical engraving style",
    styleId: "fine-wine",
    shape: "circle",
  },
  {
    occasion: "Holiday",
    title: "Snow garland",
    color: "linear-gradient(135deg, oklch(0.95 0.01 220), oklch(0.9 0.02 200))",
    prompt: "A delicate winter garland of snow-dusted evergreen branches and silver ornaments, luminous and elegant on a soft white background",
    styleId: "sparkling",
    shape: "rectangle",
  },
  {
    occasion: "Corporate",
    title: "Crisp monogram",
    color: "linear-gradient(135deg, oklch(0.92 0.01 250), oklch(0.88 0.02 240))",
    prompt: "A clean modern monogram inside a thin geometric frame, minimal flat design, neutral palette of slate and warm white",
    styleId: "modern-label",
    shape: "square",
  },
];

function OvalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <ellipse cx="12" cy="12" rx="7.5" ry="10" />
    </svg>
  );
}

function RoundedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="5" y="5" width="14" height="14" rx="4" />
    </svg>
  );
}

function DiecutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M7 7.5c0-1.1.9-2 2-2h3l1.4-1.6a1.7 1.7 0 0 1 2.8.4l.8 1.7H18a2 2 0 0 1 2 2v3l1.4 1.3a1.7 1.7 0 0 1-.3 2.8l-1.6.9V17a2 2 0 0 1-2 2h-2.4l-1.1 1.3a1.7 1.7 0 0 1-2.7-.2L9.9 19H9a2 2 0 0 1-2-2v-2.1l-1.8-1a1.7 1.7 0 0 1-.2-2.9L7 9.9Z" />
    </svg>
  );
}

const SHAPES: { id: StickerShape; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: "circle", label: "Circle", Icon: Circle },
  { id: "oval", label: "Oval", Icon: OvalIcon },
  { id: "square", label: "Square", Icon: Square },
  { id: "rectangle", label: "Rectangle", Icon: RectangleHorizontal },
  { id: "rounded", label: "Rounded", Icon: RoundedIcon },
  { id: "diecut", label: "Die-cut", Icon: DiecutIcon },
];

const SLIDER_META: Array<{
  key: SliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
  tooltip: string;
  format?: (value: number) => string;
  showEndpoints?: [string, string];
}> = [
  {
    key: "realism",
    label: "Realism",
    min: 0,
    max: 100,
    step: 1,
    tooltip: "Controls how illustrative versus lifelike the rendered sticker should feel.",
    showEndpoints: ["Cartoon / Illustrated", "Photorealistic"],
  },
  {
    key: "hue",
    label: "Color hue",
    min: 0,
    max: 360,
    step: 1,
    tooltip: "Sets the anchor hue the prompt builder converts into a named color.",
    format: (value) => `${value}°`,
  },
  {
    key: "saturation",
    label: "Color saturation",
    min: 0,
    max: 100,
    step: 1,
    tooltip: "Controls how vivid or muted the resolved color should be.",
  },
  {
    key: "lightness",
    label: "Color lightness",
    min: 0,
    max: 100,
    step: 1,
    tooltip: "Controls how bright or deep the resolved color should be.",
  },
  {
    key: "colorInfluence",
    label: "Color influence",
    min: 0,
    max: 100,
    step: 1,
    tooltip: "Controls how strongly the resolved color instruction should steer the image model.",
    showEndpoints: ["Subtle hint", "Dominant"],
  },
];

export const Route = createFileRoute("/studio/create")({
  head: () => ({
    meta: [
      { title: "Create your sticker — Sticker Studio" },
      { name: "description", content: "Design custom stickers for bottles and cans with AI." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <CreatePage />
    </RequireAuth>
  ),
});

function CreatePage() {
  const studio = useStudio();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"describe" | "templates">("describe");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(true);
  const [pendingUploads, setPendingUploads] = useState(0);

  const activeContainer = CONTAINER_CHOICES.find((choice) => choice.id === studio.container);
  const activeShape = SHAPES.find((entry) => entry.id === studio.shape);
  const resolvedColorName = useMemo(
    () => nearestNamedColor(studio.hue, studio.saturation, studio.lightness),
    [studio.hue, studio.saturation, studio.lightness],
  );
  const liveSwatch = `hsl(${studio.hue} ${studio.saturation}% ${studio.lightness}%)`;
  const previewCaption = useMemo(
    () => getLabelCaption(studio.container, studio.volume, studio.shape),
    [studio.container, studio.volume, studio.shape],
  );
  const referencePayload = useMemo(() => {
    const totalBytes = studio.referenceImages.reduce((sum, reference) => sum + estimateReferencePayloadBytes(reference.url), 0);
    const inlineCount = studio.referenceImages.filter((reference) => reference.url.startsWith("data:")).length;
    return { totalBytes, inlineCount };
  }, [studio.referenceImages]);

  const generationParams = useMemo<GenerationParams | null>(() => {
    if (!studio.container || !studio.volume) return null;
    return {
      userText: studio.prompt,
      stylePresetId: studio.stylePreset,
      shape: studio.shape,
      container: studio.container,
      volume: studio.volume,
      referenceImages: studio.referenceImages,
      realism: studio.realism,
      hue: studio.hue,
      saturation: studio.saturation,
      lightness: studio.lightness,
      colorInfluence: studio.colorInfluence,
    };
  }, [studio]);

  const built = useMemo(() => {
    if (!generationParams) return null;
    return buildPrompt(generationParams);
  }, [generationParams]);

  useEffect(() => {
    if (!studio.container || !studio.volume) {
      navigate({ to: "/studio/bottle", replace: true });
    }
  }, [studio.container, studio.volume, navigate]);

  function moderate(text: string): string | null {
    const normalized = normalizeForModeration(text);
    const hit = BLOCKLIST.find((word) => normalized.includes(word));
    if (hit) {
      return `“${hit}” isn't allowed. Try describing the mood, colors, or theme instead.`;
    }
    return null;
  }

  async function runGeneration(mode: "fresh" | "reuse") {
    if (!generationParams || !built) return;

    setError(null);
    const moderationError = moderate(studio.prompt);
    if (moderationError) {
      setError(moderationError);
      return;
    }
    if (pendingUploads > 0) {
      setError("A reference image is still uploading. Please wait a moment and try again.");
      return;
    }
    const inlineRef = studio.referenceImages.find((r) => r.url.startsWith("data:"));
    if (inlineRef) {
      setError("A reference image didn't upload correctly. Remove it and re-upload before generating.");
      return;
    }
    if (referencePayload.totalBytes > MAX_REFERENCE_TOTAL_BYTES) {
      setError("Your references are too heavy to generate reliably. Remove one or upload a smaller image.");
      return;
    }

    const seed = studio.issueSeed(mode);
    setLoading(true);

    try {
      const hostedRefs = studio.referenceImages.filter((r) => !r.url.startsWith("data:"));
      const { imageUrl } = await generateSticker({
        data: {
          prompt: built.prompt,
          negativePrompt: built.negativePrompt,
          seed,
          referenceImages: hostedRefs,
        },
      });

      studio.setImage(imageUrl);
      studio.setSeed(seed);
      studio.setLastGeneration({
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        seed,
        params: generationParams,
      });
      toast.success(mode === "reuse" ? "Regenerated with the same seed." : "Sticker generated.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function handlePromptChange(nextValue: string) {
    studio.setPrompt(nextValue.slice(0, MAX_PROMPT_LENGTH));
  }

  function onReferenceUpload(files: FileList | null) {
    if (!files?.length) return;
    const remaining = MAX_REFS - studio.referenceImages.length - pendingUploads;
    if (remaining <= 0) {
      toast.error(`You can attach up to ${MAX_REFS} reference images.`);
      return;
    }

    Array.from(files)
      .slice(0, remaining)
      .forEach((file) => {
        if (file.size > MAX_REFERENCE_FILE_SIZE) {
          toast.error(`${file.name} is over 6MB and was skipped.`);
          return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          const estimatedBytes = estimateReferencePayloadBytes(dataUrl);
          if (estimatedBytes > MAX_REFERENCE_INLINE_BYTES) {
            toast.error(`${file.name} is too large after encoding. Try a smaller image.`);
            return;
          }
          setPendingUploads((n) => n + 1);
          try {
            const { imageUrl } = await uploadReferenceImage({ data: { imageUrl: dataUrl } });
            if (!imageUrl || imageUrl.startsWith("data:")) {
              throw new Error("Upload did not return a hosted URL.");
            }
            studio.addReferenceImage(imageUrl, "Subject", 0.7);
            setError(null);
            toast.success(`${file.name} added as a reference.`);
          } catch (e) {
            const message = e instanceof Error ? e.message : "Could not upload reference image.";
            toast.error(message);
          } finally {
            setPendingUploads((n) => Math.max(0, n - 1));
          }
        };
        reader.onerror = () => toast.error(`Could not read ${file.name}.`);
        reader.readAsDataURL(file);
      });
  }

  if (!studio.container || !studio.volume) return null;

  return (
    <TooltipProvider>
      <section className="space-y-6 pb-28 md:pb-8">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/50 px-4 py-2.5 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-muted-foreground">Designing for:</span>
            <span className="truncate font-medium">
              {activeContainer?.emoji} {activeContainer?.label} · {studio.volume}
            </span>
          </div>
          <Link to="/studio/bottle" className="shrink-0 text-primary hover:underline">
            Change
          </Link>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create your sticker</h1>
          <p className="text-muted-foreground">Describe it. Preview it. Refine it.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] lg:gap-10">
          <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
            <button
              type="button"
              onClick={() => setMobilePreviewOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-[12px] border border-border/60 bg-card px-4 py-3 text-left md:hidden"
              aria-expanded={mobilePreviewOpen}
            >
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Live preview</p>
                <p className="mt-1 text-sm text-foreground">{activeContainer?.label} · {activeShape?.label}</p>
              </div>
              <ChevronRight className={["h-4 w-4 text-muted-foreground transition-transform", mobilePreviewOpen ? "rotate-90" : ""].join(" ")} />
            </button>

            <div className={["rounded-[12px] border border-border/60 bg-card p-5 md:p-6", mobilePreviewOpen ? "block" : "hidden md:block"].join(" ")}>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Live preview</p>
              <div className="mt-4 overflow-hidden rounded-[12px] border border-border/50 bg-muted/25 p-3 sm:p-4">
                <ContainerPreviewScene
                  imageUrl={studio.imageUrl}
                  shape={studio.shape}
                  textLayers={studio.textLayers}
                  whiteBorder={studio.whiteBorder}
                  container={studio.container}
                  volume={studio.volume}
                  imageTransform={studio.imageTransform}
                  size="hero"
                  className="max-h-[300px] md:max-h-none"
                />
              </div>
              {previewCaption ? <p className="mt-4 text-center text-xs tabular-nums text-muted-foreground">{previewCaption}</p> : null}
            </div>
          </aside>

          <div className="space-y-4 md:space-y-5">
            <div className="rounded-[12px] border border-border/60 bg-card p-5 md:p-6">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "describe" | "templates")}>
                <TabsList className="grid h-auto w-full grid-cols-2 rounded-[10px] bg-muted/60 p-1">
                  <TabsTrigger value="describe" className="rounded-[8px] px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    Describe it
                  </TabsTrigger>
                  <TabsTrigger value="templates" className="rounded-[8px] px-3 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    Templates
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="describe" className="mt-5 space-y-4">
                  <div className="space-y-3">
                    <div className="relative">
                      <MentionTextarea
                        placeholder="A botanical wreath in soft watercolor with elegant eucalyptus leaves on warm cream paper"
                        value={studio.prompt}
                        onChange={handlePromptChange}
                        references={studio.referenceImages}
                        maxLength={MAX_PROMPT_LENGTH}
                        className="min-h-36 resize-none rounded-[12px] border-border bg-card pb-10 text-base shadow-sm"
                      />
                      <span
                        className={[
                          "pointer-events-none absolute bottom-3 right-3 text-xs tabular-nums",
                          studio.prompt.length > PROMPT_WARNING_LENGTH ? "text-destructive" : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {studio.prompt.length}/{MAX_PROMPT_LENGTH}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Type <span className="font-mono text-primary">@</span> to reference an uploaded photo.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Reference images</p>
                        <p className="text-xs text-muted-foreground">Upload subject, palette, or style cues right below your prompt.</p>
                      </div>
                      {studio.referenceImages.length < MAX_REFS ? (
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/50 hover:text-primary">
                          <ImagePlus className="h-4 w-4" />
                          Upload reference
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              onReferenceUpload(e.target.files);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      ) : null}
                    </div>

                    {studio.referenceImages.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {studio.referenceImages.map((reference, index) => (
                          <ReferenceCard key={reference.id} reference={reference} index={index} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[12px] border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                        No references yet. Add one if you want the model to borrow a subject, palette, or style cue.
                      </div>
                    )}

                    {referencePayload.totalBytes > 0 ? (
                      <p className={[
                        "text-xs",
                        referencePayload.totalBytes > MAX_REFERENCE_TOTAL_BYTES ? "text-destructive" : "text-muted-foreground",
                      ].join(" ")}>
                        Reference load: {(referencePayload.totalBytes / (1024 * 1024)).toFixed(1)} MB
                        {referencePayload.totalBytes > MAX_REFERENCE_TOTAL_BYTES
                          ? " — too large for reliable generation."
                          : " — within the safe range for generation."}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                      {STYLE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => studio.setStylePreset(studio.stylePreset === preset.id ? null : preset.id)}
                          className={[
                            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-all",
                            studio.stylePreset === preset.id
                              ? "border-primary bg-primary-soft text-primary shadow-sm"
                              : "border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                          ].join(" ")}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="templates" className="mt-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {TEMPLATES.map((template) => {
                      const styleLabel = STYLE_PRESETS.find((preset) => preset.id === template.styleId)?.label;
                      return (
                        <button
                          key={template.title}
                          type="button"
                          onClick={() => {
                            studio.setPrompt(template.prompt);
                            studio.setStylePreset(template.styleId);
                            studio.setShape(template.shape);
                            setActiveTab("describe");
                            toast.success(`Loaded “${template.title}”.`);
                          }}
                          className="group text-left"
                        >
                          <div
                            className="relative aspect-square overflow-hidden rounded-[12px] border border-border/60 shadow-soft transition-transform group-hover:-translate-y-0.5 group-hover:shadow-soft-lg"
                            style={{ backgroundImage: template.color }}
                          >
                            {styleLabel ? (
                              <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground/80 backdrop-blur-sm">
                                {styleLabel}
                              </span>
                            ) : null}
                            <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 opacity-0 transition-opacity group-hover:bg-foreground/30 group-hover:opacity-100">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm">
                                <Wand2 className="h-3.5 w-3.5" /> Use this
                              </span>
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium">{template.title}</p>
                          <p className="text-xs text-muted-foreground">{template.occasion}</p>
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="rounded-[12px] border border-border/60 bg-card p-5 md:p-6">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {SHAPES.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => studio.setShape(id)}
                    className={[
                      "flex aspect-square flex-col items-center justify-center gap-2 rounded-[10px] border px-2 py-3 text-center transition-all",
                      studio.shape === id
                        ? "border-2 border-primary text-primary"
                        : "border border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[11px] font-medium leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[12px] border border-border/60 bg-card p-5 md:p-6">
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
                  <div>
                    <p className="text-sm font-medium text-foreground">⚙ Advanced: realism, color, seed</p>
                    <p className="mt-1 text-xs text-muted-foreground">Adjust these when you want tighter control over style consistency.</p>
                  </div>
                  <ChevronRight className={["h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", advancedOpen ? "rotate-90" : ""].join(" ")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <div className="mt-5 space-y-5 border-t border-border/60 pt-5">
                    {SLIDER_META.map((slider, index) => (
                      <div key={slider.key} className="space-y-3">
                        {index > 0 ? <div className="border-t border-border/50" /> : null}
                        <div className={index > 0 ? "pt-5" : ""}>
                          <SliderField
                            slider={slider}
                            value={studio[slider.key]}
                            onChange={(value) => studio.setSliderValue(slider.key, value, true)}
                            trackStyle={slider.key === "hue" ? { backgroundImage: "linear-gradient(90deg, hsl(0 80% 55%), hsl(60 80% 55%), hsl(120 70% 45%), hsl(180 70% 45%), hsl(240 80% 60%), hsl(300 75% 60%), hsl(360 80% 55%))" } : undefined}
                          >
                            {slider.key === "hue" ? (
                              <div className="mt-3 flex items-center gap-3 rounded-[10px] bg-muted/35 p-3">
                                <span className="h-9 w-9 rounded-full border border-border/70 shadow-sm" style={{ backgroundColor: liveSwatch }} />
                                <div>
                                  <p className="text-sm font-medium text-foreground">{resolvedColorName}</p>
                                  <p className="text-xs text-muted-foreground">≈ {resolvedColorName}</p>
                                </div>
                              </div>
                            ) : null}
                          </SliderField>
                        </div>
                      </div>
                    ))}

                    <div className="border-t border-border/50 pt-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <Label htmlFor="lock-seed" className="text-sm font-medium">Lock seed</Label>
                          <p className="text-xs text-muted-foreground">Keep the same visual base across regenerations.</p>
                        </div>
                        <Switch id="lock-seed" checked={studio.lockSeed} onCheckedChange={studio.setLockSeed} />
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">Current seed: {studio.seed ?? "Auto"}</p>
                    </div>

                    <div className="border-t border-border/50 pt-5">
                      <ImageFramingControls compact />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <div className="rounded-[12px] border border-border/60 bg-card p-5 md:p-6">
              <Collapsible open={textOpen} onOpenChange={setTextOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
                  <div>
                    <p className="text-sm font-medium text-foreground">Text layers</p>
                    <p className="mt-1 text-xs text-muted-foreground">Optional</p>
                  </div>
                  <ChevronRight className={["h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", textOpen ? "rotate-90" : ""].join(" ")} />
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <div className="mt-5 border-t border-border/60 pt-5">
                    <TextLayerEditor compact />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <div className="rounded-[12px] border border-border/60 bg-card px-5 py-4 md:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="border-toggle" className="text-sm font-medium">White die-cut border</Label>
                </div>
                <Switch id="border-toggle" checked={studio.whiteBorder} onCheckedChange={studio.setWhiteBorder} />
              </div>
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-[12px] bg-destructive/10 p-3 text-sm text-destructive">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="rounded-[12px] border border-border/60 bg-card p-5 md:p-6">
              <div className="space-y-3 md:space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={() => runGeneration("fresh")}
                    disabled={loading || !studio.prompt.trim() || !built}
                    size="lg"
                    className="flex-1 rounded-full bg-foreground text-background hover:opacity-95"
                    title={!studio.prompt.trim() ? "Add a description to generate" : undefined}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Designing your sticker…
                      </>
                    ) : (
                      "Generate sticker"
                    )}
                  </Button>
                  {studio.imageUrl ? (
                    <Button
                      variant="outline"
                      onClick={() => runGeneration("reuse")}
                      disabled={loading || !studio.lastGeneration}
                      size="lg"
                      className="rounded-full px-4"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span className="sr-only">Regenerate</span>
                    </Button>
                  ) : null}
                </div>

                {studio.imageUrl ? (
                  <Button asChild variant="outline" size="lg" className="w-full rounded-full">
                    <Link to="/studio/preview">
                      Continue <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            {import.meta.env.DEV && studio.lastGeneration && built ? (
              <Collapsible className="rounded-[12px] border border-border/60 bg-card p-5 md:p-6">
                <CollapsibleTrigger className="flex w-full items-center justify-between text-left text-sm font-medium">
                  Debug
                  <span className="text-xs text-muted-foreground">Seed {studio.lastGeneration.seed}</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-4 text-xs text-muted-foreground">
                  <DebugRow label="Seed" value={String(studio.lastGeneration.seed)} />
                  <DebugRow label="Color" value={resolvedColorName} />
                  <DebugRow label="Prompt" value={studio.lastGeneration.prompt} multiline />
                  <DebugRow label="Negative" value={studio.lastGeneration.negativePrompt} multiline />
                  <DebugRow label="Params" value={JSON.stringify(studio.lastGeneration.params, null, 2)} multiline />
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 p-3 backdrop-blur md:hidden">
          <Button
            onClick={() => runGeneration("fresh")}
            disabled={loading || !studio.prompt.trim() || !built}
            size="lg"
            className="w-full rounded-full bg-foreground text-background hover:opacity-95"
            title={!studio.prompt.trim() ? "Add a description to generate" : undefined}
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Designing your sticker…
              </>
            ) : (
              "Generate sticker"
            )}
          </Button>
        </div>
      </section>
    </TooltipProvider>
  );
}

function SectionLabel({ label, tooltip, compact = false }: { label: string; tooltip: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <p className={["font-medium text-foreground", compact ? "text-sm" : "text-xs uppercase tracking-wider text-muted-foreground"].join(" ")}>
        {label}
      </p>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground transition-colors hover:text-foreground" aria-label={`${label} help`}>
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function SliderField({
  slider,
  value,
  onChange,
  trackStyle,
  children,
}: {
  slider: (typeof SLIDER_META)[number];
  value: number;
  onChange: (value: number) => void;
  trackStyle?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <SectionLabel label={slider.label} tooltip={slider.tooltip} compact />
        <span className="text-sm tabular-nums text-foreground">{slider.format ? slider.format(value) : value}</span>
      </div>
      <Slider
        value={[value]}
        min={slider.min}
        max={slider.max}
        step={slider.step}
        onValueChange={(values) => onChange(values[0] ?? value)}
        className="mt-3"
        trackClassName={slider.key === "hue" ? "bg-transparent" : undefined}
        rangeClassName={slider.key === "hue" ? "bg-transparent" : undefined}
      />
      {trackStyle ? <div className="pointer-events-none relative -mt-1.5 h-1.5 w-full rounded-full" style={trackStyle} /> : null}
      {slider.showEndpoints ? (
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{slider.showEndpoints[0]}</span>
          <span>{slider.showEndpoints[1]}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

function ReferenceCard({ reference, index }: { reference: ReferenceImage; index: number }) {
  const studio = useStudio();
  const weight = reference.weight ?? 0.7;
  const strengthLabel = weight >= 0.85 ? "Strong" : weight >= 0.55 ? "Guided" : "Light";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative aspect-square">
        <img src={reference.url} alt={`Reference ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
        <button
          type="button"
          onClick={() => studio.removeReferenceImage(reference.id)}
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background/90 shadow-sm transition-colors hover:bg-background"
          aria-label="Remove reference"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-3 p-3">
        <div className="space-y-1.5">
          <Input
            value={reference.role}
            onChange={(e) => studio.updateReferenceImageRole(reference.id, e.target.value.slice(0, 60))}
            placeholder="Role"
            list={`role-presets-${reference.id}`}
            className="h-9 rounded-xl text-xs"
          />
          <datalist id={`role-presets-${reference.id}`}>
            {ROLE_PRESETS.map((preset) => (
              <option key={preset} value={preset} />
            ))}
          </datalist>
          <div className="flex flex-wrap gap-1">
            {ROLE_PRESETS.slice(0, 3).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => studio.updateReferenceImageRole(reference.id, preset)}
                className={[
                  "rounded-full px-1.5 py-0.5 text-[10px] transition-colors",
                  reference.role.toLowerCase() === preset.toLowerCase()
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                ].join(" ")}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Weight</span>
            <span>{strengthLabel} · {weight.toFixed(1)}</span>
          </div>
          <Slider
            value={[weight]}
            min={0.2}
            max={1}
            step={0.05}
            onValueChange={(values) => studio.updateReferenceImageWeight(reference.id, Number((values[0] ?? weight).toFixed(2)))}
            className="mt-2"
          />
        </div>
      </div>
    </div>
  );
}

function ImageFramingControls({ compact = false }: { compact?: boolean }) {
  const studio = useStudio();

  if (!studio.imageUrl) return null;

  return (
    <div className={compact ? "space-y-4" : "rounded-2xl border border-border/60 bg-muted/30 p-4"}>
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel label="Image framing" tooltip="Adjust the composition of the generated art inside the sticker before previewing or ordering." compact />
        <Button variant="ghost" size="sm" onClick={studio.resetImageTransform} className="rounded-full text-xs">
          Reset
        </Button>
      </div>
      <div className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Zoom {studio.imageTransform.scale.toFixed(2)}×</Label>
          <Slider
            value={[studio.imageTransform.scale]}
            min={0.8}
            max={2.5}
            step={0.05}
            onValueChange={(values) => studio.setImageTransform({ scale: values[0] ?? studio.imageTransform.scale })}
            className="mt-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Horizontal</Label>
            <Slider
              value={[studio.imageTransform.offsetX]}
              min={-50}
              max={50}
              step={1}
              onValueChange={(values) => studio.setImageTransform({ offsetX: values[0] ?? studio.imageTransform.offsetX })}
              className="mt-2"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Vertical</Label>
            <Slider
              value={[studio.imageTransform.offsetY]}
              min={-50}
              max={50}
              step={1}
              onValueChange={(values) => studio.setImageTransform({ offsetY: values[0] ?? studio.imageTransform.offsetY })}
              className="mt-2"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TextLayerEditor({ compact = false }: { compact?: boolean }) {
  const studio = useStudio();

  return (
    <div className={compact ? "space-y-4" : "rounded-2xl border border-border/60 bg-muted/30 p-4"}>
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel label="Text layers" tooltip="Describe the text you want — we'll style it onto the sticker." compact />
        <Button variant="ghost" size="sm" onClick={studio.addTextLayer} disabled={studio.textLayers.length >= 2} className="rounded-full">
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>
      {studio.textLayers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Describe what you want and we'll style it onto the sticker.
        </p>
      ) : (
        <div className="space-y-3">
          {studio.textLayers.map((layer) => (
            <TextLayerCard key={layer.id} layer={layer} />
          ))}
        </div>
      )}
    </div>
  );
}

function TextLayerCard({ layer }: { layer: TextLayer }) {
  const studio = useStudio();
  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState<string>(layer.aiPrompt ?? "");
  const [resolving, setResolving] = useState(false);
  const styleAppliedRef = useRef(false);
  const lastResolvedRef = useRef<string>("");

  useEffect(() => {
    FONT_LIBRARY.forEach((font) => ensureFontLoaded(font.family));
  }, []);

  // Debounced resolve when description changes
  useEffect(() => {
    const trimmed = description.trim();
    if (!trimmed) return;
    if (trimmed === lastResolvedRef.current) return;

    const handle = setTimeout(async () => {
      lastResolvedRef.current = trimmed;
      setResolving(true);
      try {
        const result = await resolveTextLayer({ data: { description: trimmed } });
        // Persist the description on the layer so it survives reloads
        const patch: Partial<TextLayer> = { aiPrompt: trimmed, text: result.text };
        if (!styleAppliedRef.current) {
          if (result.suggestedFont) {
            patch.font = result.suggestedFont;
            ensureFontLoaded(result.suggestedFont);
          }
          if (result.suggestedColor) patch.color = result.suggestedColor;
          if (result.suggestedPosition === "top") patch.y = 18;
          else if (result.suggestedPosition === "middle") patch.y = 50;
          else if (result.suggestedPosition === "bottom") patch.y = 82;
          styleAppliedRef.current = true;
        }
        studio.updateTextLayer(layer.id, patch);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not interpret text");
      } finally {
        setResolving(false);
      }
    }, 600);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, layer.id]);

  function onFontFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(`${file.name} is over 2MB.`);
      return;
    }
    const format = detectFontFormat(file.name);
    if (!format) {
      toast.error("Use a .ttf, .otf, .woff or .woff2 file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const id = studio.addCustomFont({
        name: file.name,
        dataUrl: reader.result as string,
        format,
      });
      studio.updateTextLayer(layer.id, { font: `user-${id}` });
      toast.success(`${file.name} ready to use`);
    };
    reader.onerror = () => toast.error("Could not read font file.");
    reader.readAsDataURL(file);
  }

  const groupedFonts = CATEGORY_ORDER.map((category) => ({
    category,
    fonts: FONT_LIBRARY.filter((font) => font.category === category),
  }));

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <Label className="text-xs font-medium text-foreground">Describe the text</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`e.g. "Sarah & Tom" in elegant gold script along the top`}
            className="mt-1.5 min-h-20 rounded-xl text-sm"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {resolving
              ? "Interpreting…"
              : layer.text
                ? `Rendering: "${layer.text}"`
                : "Tip: put exact words in quotes to keep them verbatim."}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => studio.removeTextLayer(layer.id)} className="shrink-0 rounded-xl">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            value={layer.font}
            onChange={(e) => {
              const next = e.target.value;
              studio.updateTextLayer(layer.id, { font: next });
              ensureFontLoaded(next);
            }}
            className="min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm"
            style={{ fontFamily: getFontFamilyCSS(layer.font, studio.customFonts) }}
          >
            {studio.customFonts.length > 0 && (
              <optgroup label="Your fonts">
                {studio.customFonts.map((font) => (
                  <option key={font.id} value={`user-${font.id}`} style={{ fontFamily: `'user-${font.id}', system-ui` }}>
                    {font.name}
                  </option>
                ))}
              </optgroup>
            )}
            {groupedFonts.map(({ category, fonts }) => (
              <optgroup key={category} label={category}>
                {fonts.map((font) => (
                  <option key={font.family} value={font.family} style={{ fontFamily: `'${font.family}', ${font.fallback}` }}>
                    {font.family}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="h-9 rounded-xl px-3">
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
            className="hidden"
            onChange={onFontFileChange}
          />
        </div>
        {layer.font.startsWith("user-") ? (
          <button
            type="button"
            onClick={() => {
              const id = layer.font.slice("user-".length);
              studio.removeCustomFont(id);
              studio.updateTextLayer(layer.id, { font: "Inter" });
            }}
            className="text-[11px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
          >
            Remove uploaded font
          </button>
        ) : (
          <p className="text-[10px] text-muted-foreground/80">Upload your own .ttf, .otf, .woff or .woff2 (max 2MB).</p>
        )}
        <input
          type="color"
          value={layer.color}
          onChange={(e) => studio.updateTextLayer(layer.id, { color: e.target.value })}
          className="h-9 w-full cursor-pointer rounded-xl border border-input bg-background"
          aria-label="Text color"
        />
        <div>
          <Label className="text-xs text-muted-foreground">Size {layer.size}px</Label>
          <Slider value={[layer.size]} min={10} max={48} step={1} onValueChange={(values) => studio.updateTextLayer(layer.id, { size: values[0] ?? layer.size })} className="mt-2" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Horizontal</Label>
            <Slider value={[layer.x]} min={0} max={100} step={1} onValueChange={(values) => studio.updateTextLayer(layer.id, { x: values[0] ?? layer.x })} className="mt-2" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Vertical</Label>
            <Slider value={[layer.y]} min={0} max={100} step={1} onValueChange={(values) => studio.updateTextLayer(layer.id, { y: values[0] ?? layer.y })} className="mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DebugRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="font-medium text-foreground">{label}</p>
      <pre className={["mt-1 whitespace-pre-wrap break-words rounded-xl bg-background/80 p-2 font-mono text-[11px]", multiline ? "max-h-40 overflow-auto" : ""].join(" ")}>
        {value}
      </pre>
    </div>
  );
}
