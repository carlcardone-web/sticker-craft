import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStudio, getLabelDimensions, CONTAINER_CHOICES, SHAPE_CHOICES } from "@/lib/studio-store";
import { StickerArtwork } from "@/components/studio/StickerArtwork";
import { ArrowLeft, Check, Download, Package, Truck } from "lucide-react";

export const Route = createFileRoute("/studio/checkout")({
  head: () => ({
    meta: [
      { title: "Download or order — Sticker Studio" },
      { name: "description", content: "Free download or ship physical stickers." },
    ],
  }),
  component: CheckoutPage,
});

const QUANTITIES = [50, 100, 250, 500];
const SIZES = [
  { id: "2in", label: '2"', mult: 1 },
  { id: "3in", label: '3"', mult: 1.4 },
  { id: "4in", label: '4"', mult: 1.85 },
  { id: "5in", label: '5"', mult: 2.3 },
];

function priceFor(qty: number, sizeMult: number) {
  const base = (qty / 100) * 49 * sizeMult;
  return Math.round(base * 100) / 100;
}

function CheckoutPage() {
  const s = useStudio();
  const [qty, setQty] = useState(100);
  const [sizeId, setSizeId] = useState<string>("3in");
  const [downloaded, setDownloaded] = useState(false);
  const size = SIZES.find((x) => x.id === sizeId) ?? SIZES[1];
  const price = priceFor(qty, size.mult);

  function handleDownload() {
    // Stub: trigger image download. Real version generates 300dpi PNG + PDF zip.
    if (!s.imageUrl) return;
    const a = document.createElement("a");
    a.href = s.imageUrl;
    a.download = "sticker-design.png";
    a.click();
    setDownloaded(true);
  }

  const dims = getLabelDimensions(s.container, s.volume);
  const isFixedSquare = s.shape === "circle" || s.shape === "square" || s.shape === "rounded";
  const labelW = dims ? (isFixedSquare ? Math.min(dims.w, dims.h) : dims.w) : null;
  const labelH = dims ? (isFixedSquare ? Math.min(dims.w, dims.h) : dims.h) : null;
  const containerInfo = CONTAINER_CHOICES.find((c) => c.id === s.container);
  const shapeInfo = SHAPE_CHOICES.find((sh) => sh.id === s.shape);

  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-8 lg:gap-12">
      <section className="rounded-3xl bg-card p-8 shadow-soft border border-border/60 flex flex-col items-center justify-center">
        <StickerArtwork imageUrl={s.imageUrl} shape={s.shape} textLayers={s.textLayers} whiteBorder={s.whiteBorder} container={s.container} volume={s.volume} size={300} showDimensions />
        <p className="mt-6 text-sm text-muted-foreground">Your sticker is ready.</p>
      </section>

      <section className="space-y-5">
        <div className="rounded-3xl bg-card border border-border/60 shadow-soft p-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Specifications</p>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Container</dt>
            <dd className="text-right font-medium">{containerInfo ? `${containerInfo.emoji} ${containerInfo.label}` : "—"}</dd>
            <dt className="text-muted-foreground">Volume</dt>
            <dd className="text-right font-medium">{s.volume ?? "—"}</dd>
            <dt className="text-muted-foreground">Shape</dt>
            <dd className="text-right font-medium">{shapeInfo?.label ?? s.shape}</dd>
            <dt className="text-muted-foreground">Label size</dt>
            <dd className="text-right font-medium tabular-nums">{labelW && labelH ? `${labelW} × ${labelH} cm` : "—"}</dd>
          </dl>
        </div>

        <div className="rounded-3xl bg-card border border-border/60 shadow-soft p-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary-soft flex items-center justify-center text-primary-deep">
              <Download className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Download — free</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Print-ready 300 DPI PNG with transparent background, plus PDF with 3mm bleed.</p>
            </div>
          </div>
          <Button onClick={handleDownload} disabled={!s.imageUrl} className="w-full mt-5 rounded-full" variant="outline" size="lg">
            {downloaded ? (<><Check className="h-4 w-4 mr-2" /> Downloaded</>) : "Download files"}
          </Button>
        </div>

        <div className="rounded-3xl bg-card border border-border/60 shadow-soft p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-sage flex items-center justify-center text-primary-foreground">
              <Package className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Order prints</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Pro-quality vinyl, shipped to your door.</p>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quantity</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {QUANTITIES.map((q) => (
                <button key={q} onClick={() => setQty(q)} className={["py-2.5 rounded-xl text-sm font-medium border transition-all", qty === q ? "border-primary bg-primary-soft" : "border-border bg-background hover:border-primary/40"].join(" ")}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Size</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {SIZES.map((sz) => (
                <button key={sz.id} onClick={() => setSizeId(sz.id)} className={["py-2.5 rounded-xl text-sm font-medium border transition-all", sizeId === sz.id ? "border-primary bg-primary-soft" : "border-border bg-background hover:border-primary/40"].join(" ")}>
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Ship to</Label>
            <Input placeholder="Full name" className="rounded-xl" />
            <Input placeholder="Street address" className="rounded-xl" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="City" className="rounded-xl" />
              <Input placeholder="ZIP / Postal" className="rounded-xl" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Truck className="h-4 w-4" /> Ships in 3–5 days
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-semibold tracking-tight">${price.toFixed(2)}</p>
            </div>
          </div>

          <Button size="lg" className="w-full rounded-full shadow-glow bg-gradient-sage text-primary-foreground hover:opacity-95" onClick={() => alert("TODO: wire Sticker Mule + Stripe in next iteration.")}>
            Place order — ${price.toFixed(2)}
          </Button>
        </div>

        <Button variant="ghost" asChild className="rounded-full">
          <Link to="/studio/preview"><ArrowLeft className="h-4 w-4 mr-1" /> Back to preview</Link>
        </Button>
      </section>
    </div>
  );
}
