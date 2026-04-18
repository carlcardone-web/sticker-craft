import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  FONT_CHOICES,
  CONTAINER_CHOICES,
  getLabelDimensions,
  useStudio,
  type TextLayer,
} from "@/lib/studio-store";
import { StickerArtwork } from "@/components/studio/StickerArtwork";
import { editStickerWithText } from "@/server/edit-sticker-with-text";
import {
  ArrowLeft, ArrowRight, Plus, Trash2, ImagePlus, X, Sparkles, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/studio/customize")({
  head: () => ({
    meta: [
      { title: "Customize — Sticker Studio" },
      { name: "description", content: "Add text and finish your sticker." },
    ],
  }),
  component: CustomizePage,
});

const STYLE_CHIPS = [
  "Flowing calligraphy",
  "Bold serif",
  "Hand-painted",
  "Vintage signpainter",
  "Neon glow",
  "Gold foil",
  "Brush script",
  "Engraved",
];

const TEXT_REF_ROLES = ["Font style", "Color palette", "Mood"];

function CustomizePage() {
  const s = useStudio();
  const navigate = useNavigate();

  useEffect(() => {
    if (!s.container || !s.volume) {
      navigate({ to: "/studio/bottle" });
    }
  }, [s.container, s.volume, navigate]);

  const containerLabel = CONTAINER_CHOICES.find((c) => c.id === s.container)?.label ?? s.container ?? "Bottle";
  const containerEmoji = CONTAINER_CHOICES.find((c) => c.id === s.container)?.emoji ?? "";
  const dims = getLabelDimensions(s.container, s.volume);
  const dimsLabel = dims ? `${dims.w} × ${dims.h} cm` : null;

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-8 lg:gap-12">
      <aside className="space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Add the finishing touches</h1>
          <p className="mt-1 text-muted-foreground text-sm">Text and border — fully editable.</p>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-muted/50 border border-border/60 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground shrink-0">Designing for:</span>
            <span className="font-medium truncate">
              {containerEmoji} {containerLabel} · {s.volume}{dimsLabel ? ` · label ${dimsLabel}` : ""}
            </span>
          </div>
          <Link to="/studio/bottle" className="text-primary hover:underline shrink-0 ml-2">Change</Link>
        </div>

        {s.imageUrl && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Image framing</p>
              <Button variant="ghost" size="sm" onClick={s.resetImageTransform} className="rounded-full text-xs">
                Reset
              </Button>
            </div>
            <div className="rounded-2xl bg-card border border-border/60 p-4 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Zoom {s.imageTransform.scale.toFixed(2)}×</Label>
                <Slider
                  value={[s.imageTransform.scale]}
                  min={0.8}
                  max={2.5}
                  step={0.05}
                  onValueChange={(v) => s.setImageTransform({ scale: v[0] })}
                  className="mt-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Horizontal</Label>
                  <Slider
                    value={[s.imageTransform.offsetX]}
                    min={-50}
                    max={50}
                    step={1}
                    onValueChange={(v) => s.setImageTransform({ offsetX: v[0] })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Vertical</Label>
                  <Slider
                    value={[s.imageTransform.offsetY]}
                    min={-50}
                    max={50}
                    step={1}
                    onValueChange={(v) => s.setImageTransform({ offsetY: v[0] })}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between rounded-2xl bg-card border border-border/60 p-3">
            <Label htmlFor="border" className="text-sm">White die-cut border</Label>
            <Switch id="border" checked={s.whiteBorder} onCheckedChange={s.setWhiteBorder} />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Text layers</p>
            <Button variant="ghost" size="sm" onClick={s.addTextLayer} disabled={s.textLayers.length >= 2} className="rounded-full">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          {s.textLayers.length === 0 && (
            <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-4 text-center">
              Add up to 2 text layers — type or generate them with AI.
            </p>
          )}
          <div className="space-y-3">
            {s.textLayers.map((l) => (
              <TextLayerCard key={l.id} layer={l} />
            ))}
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" asChild className="rounded-full">
            <Link to="/studio/create"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
          </Button>
          <Button asChild className="rounded-full flex-1 shadow-glow bg-gradient-sage text-primary-foreground hover:opacity-95">
            <Link to="/studio/preview">Preview <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
      </aside>

      <section className="rounded-3xl bg-card p-8 lg:p-12 shadow-soft border border-border/60 flex items-center justify-center min-h-[420px]">
        <StickerArtwork
          imageUrl={s.imageUrl}
          shape={s.shape}
          textLayers={s.textLayers}
          whiteBorder={s.whiteBorder}
          container={s.container}
          volume={s.volume}
          size={360}
          showDimensions
          showScaleHint
          imageTransform={s.imageTransform}
        />
      </section>
    </div>
  );
}

function TextLayerCard({ layer: l }: { layer: TextLayer }) {
  const s = useStudio();
  const [generating, setGenerating] = useState(false);
  const mode = l.mode ?? "text";
  const aiPrompt = l.aiPrompt ?? "";
  const aiRefs = l.aiReferences ?? [];

  function onRefUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = 2 - aiRefs.length;
    if (remaining <= 0) {
      toast.error("Up to 2 references per text layer.");
      return;
    }
    Array.from(files).slice(0, remaining).forEach((file) => {
      if (file.size > 6 * 1024 * 1024) {
        toast.error(`${file.name} is over 6MB and was skipped.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        s.addTextLayerReference(l.id, reader.result as string, "Font style");
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleGenerate() {
    if (!s.imageUrl) {
      toast.error("Generate the artwork on the previous step first.");
      return;
    }
    if (!l.text.trim()) {
      toast.error("Add the phrase to render first.");
      return;
    }
    if (!aiPrompt.trim()) {
      toast.error("Describe the style you want.");
      return;
    }
    setGenerating(true);
    try {
      const { imageUrl } = await editStickerWithText({
        data: {
          baseImageUrl: s.imageUrl,
          text: l.text,
          prompt: aiPrompt,
          references: aiRefs.map((r) => ({ url: r.url, role: r.role })),
          shape: s.shape,
          container: s.container,
          volume: s.volume,
          color: l.color,
        },
      });
      s.setImage(imageUrl);
      s.removeTextLayer(l.id);
      toast.success("Text added to your artwork");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Tabs value={mode} onValueChange={(v) => s.updateTextLayer(l.id, { mode: v as "text" | "ai" })} className="flex-1">
          <TabsList className="bg-muted/60 p-0.5 rounded-full h-auto w-full grid grid-cols-2">
            <TabsTrigger value="text" className="rounded-full px-3 py-1 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Type text
            </TabsTrigger>
            <TabsTrigger value="ai" className="rounded-full px-3 py-1 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Sparkles className="h-3 w-3 mr-1" /> AI text
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="icon" onClick={() => s.removeTextLayer(l.id)} className="rounded-xl shrink-0">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Input
        value={l.text}
        onChange={(e) => s.updateTextLayer(l.id, { text: e.target.value })}
        className="rounded-xl"
        placeholder="The phrase to render"
      />

      {mode === "text" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={l.font}
              onChange={(e) => s.updateTextLayer(l.id, { font: e.target.value })}
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {FONT_CHOICES.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>
            <input
              type="color"
              value={l.color}
              onChange={(e) => s.updateTextLayer(l.id, { color: e.target.value })}
              className="rounded-xl border border-input h-9 w-full bg-background cursor-pointer"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Size {l.size}px</Label>
            <Slider value={[l.size]} min={10} max={48} step={1} onValueChange={(v) => s.updateTextLayer(l.id, { size: v[0] })} className="mt-2" />
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <Textarea
            value={aiPrompt}
            onChange={(e) => s.updateTextLayer(l.id, { aiPrompt: e.target.value })}
            placeholder="e.g. flowing gold calligraphy with elegant flourishes"
            className="rounded-xl min-h-20 text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {STYLE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => {
                  const next = aiPrompt ? `${aiPrompt}, ${chip.toLowerCase()}` : chip;
                  s.updateTextLayer(l.id, { aiPrompt: next });
                }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
              References (optional, up to 2)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {aiRefs.map((r, i) => (
                <div key={r.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="relative aspect-square">
                    <img src={r.url} alt={`ref ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => s.removeTextLayerReference(l.id, r.id)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-background/90 border border-border flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <select
                    value={r.role}
                    onChange={(e) => s.updateTextLayerReference(l.id, r.id, e.target.value)}
                    className="w-full text-[10px] px-1 py-1 bg-muted/60 border-t border-border outline-none"
                  >
                    {TEXT_REF_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </div>
              ))}
              {aiRefs.length < 2 && (
                <label className="aspect-square flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { onRefUpload(e.target.files); e.target.value = ""; }}
                  />
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Add</span>
                </label>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={generating} size="sm" className="rounded-full flex-1 bg-gradient-sage text-primary-foreground hover:opacity-95">
              {generating ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating…</>
              ) : l.aiImageUrl ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerate</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate text</>
              )}
            </Button>
            {l.aiImageUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => s.setTextLayerAiImage(l.id, null)}
                className="rounded-full"
              >
                Clear
              </Button>
            )}
          </div>

          {l.aiImageUrl && (
            <div className="rounded-xl border border-border p-2 flex items-center justify-center">
              <img src={l.aiImageUrl} alt="Generated text" className="max-h-20 object-contain" />
            </div>
          )}

          {l.aiImageUrl && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Size {aiWidth}%</Label>
                <Slider
                  value={[aiWidth]}
                  min={20}
                  max={100}
                  step={1}
                  onValueChange={(v) => s.updateTextLayer(l.id, { aiWidth: v[0] })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Rotation {rotation}°</Label>
                <Slider
                  value={[rotation]}
                  min={-45}
                  max={45}
                  step={1}
                  onValueChange={(v) => s.updateTextLayer(l.id, { rotation: v[0] })}
                  className="mt-2"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">Horizontal</Label>
          <Slider value={[l.x]} min={0} max={100} step={1} onValueChange={(v) => s.updateTextLayer(l.id, { x: v[0] })} className="mt-2" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Vertical</Label>
          <Slider value={[l.y]} min={0} max={100} step={1} onValueChange={(v) => s.updateTextLayer(l.id, { y: v[0] })} className="mt-2" />
        </div>
      </div>
    </div>
  );
}
