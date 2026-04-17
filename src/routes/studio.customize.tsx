import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FONT_CHOICES, useStudio, type StickerShape } from "@/lib/studio-store";
import { StickerArtwork } from "@/components/studio/StickerArtwork";
import { ArrowLeft, ArrowRight, Plus, Trash2, Circle, Square, RectangleHorizontal, Squircle } from "lucide-react";

export const Route = createFileRoute("/studio/customize")({
  head: () => ({
    meta: [
      { title: "Customize — Sticker Studio" },
      { name: "description", content: "Pick a shape and add your text." },
    ],
  }),
  component: CustomizePage,
});

const SHAPES: { id: StickerShape; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "circle", label: "Circle", Icon: Circle },
  { id: "square", label: "Square", Icon: Square },
  { id: "rectangle", label: "Rectangle", Icon: RectangleHorizontal },
  { id: "rounded", label: "Rounded", Icon: Squircle },
  { id: "oval", label: "Oval", Icon: Circle },
  { id: "diecut", label: "Die-cut", Icon: Squircle },
];

function CustomizePage() {
  const s = useStudio();

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-8 lg:gap-12">
      <aside className="space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Make it yours</h1>
          <p className="mt-1 text-muted-foreground text-sm">Shape and text — fully editable.</p>
        </div>

        <section>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Shape</p>
          <div className="grid grid-cols-3 gap-2">
            {SHAPES.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => s.setShape(id)}
                className={[
                  "flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all",
                  s.shape === id
                    ? "border-primary bg-primary-soft shadow-sm"
                    : "border-border bg-card hover:border-primary/40",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-card border border-border/60 p-3">
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
        <StickerArtwork imageUrl={s.imageUrl} shape={s.shape} textLayers={s.textLayers} whiteBorder={s.whiteBorder} size={360} />
      </section>
    </div>
  );
}
