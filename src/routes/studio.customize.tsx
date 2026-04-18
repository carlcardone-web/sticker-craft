import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  FONT_CHOICES,
  CONTAINER_CHOICES,
  getLabelDimensions,
  useStudio,
} from "@/lib/studio-store";
import { StickerArtwork } from "@/components/studio/StickerArtwork";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/studio/customize")({
  head: () => ({
    meta: [
      { title: "Customize — Sticker Studio" },
      { name: "description", content: "Add text and finish your sticker." },
    ],
  }),
  component: CustomizePage,
});

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
              Add up to 2 text layers — names, dates, anything.
            </p>
          )}
          <div className="space-y-3">
            {s.textLayers.map((l) => (
              <div key={l.id} className="rounded-2xl bg-card border border-border/60 p-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={l.text}
                    onChange={(e) => s.updateTextLayer(l.id, { text: e.target.value })}
                    className="rounded-xl"
                  />
                  <Button variant="ghost" size="icon" onClick={() => s.removeTextLayer(l.id)} className="rounded-xl shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
        />
      </section>
    </div>
  );
}
