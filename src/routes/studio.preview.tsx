import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useStudio, getLabelDimensions, type StickerShape } from "@/lib/studio-store";
import { StickerArtwork } from "@/components/studio/StickerArtwork";
import { ArrowLeft, ArrowRight } from "lucide-react";
import wineImg from "@/assets/mockups/wine-bottle.jpg";
import beerImg from "@/assets/mockups/beer-bottle.jpg";
import sodaImg from "@/assets/mockups/soda-can.jpg";
import slimImg from "@/assets/mockups/slim-can.jpg";
import waterImg from "@/assets/mockups/water-bottle.jpg";
import jarImg from "@/assets/mockups/mason-jar.jpg";

function LabelDimsCaption({ container, volume, shape }: { container: string | null; volume: string | null; shape: StickerShape }) {
  const dims = getLabelDimensions(container, volume);
  if (!dims) return null;
  const isFixedSquare = shape === "circle" || shape === "square" || shape === "rounded";
  const w = isFixedSquare ? Math.min(dims.w, dims.h) : dims.w;
  const h = isFixedSquare ? Math.min(dims.w, dims.h) : dims.h;
  return (
    <p className="mt-3 text-center text-xs text-muted-foreground tabular-nums">Label size: {w} × {h} cm</p>
  );
}

export const Route = createFileRoute("/studio/preview")({
  head: () => ({
    meta: [
      { title: "Preview on bottles & cans — Sticker Studio" },
      { name: "description", content: "See your sticker on real containers." },
    ],
  }),
  component: PreviewPage,
});

const CONTAINERS = [
  { id: "wine", label: "Wine bottle", img: wineImg, stickerSize: 130, top: "52%" },
  { id: "beer", label: "Beer bottle", img: beerImg, stickerSize: 120, top: "60%" },
  { id: "soda", label: "Soda can", img: sodaImg, stickerSize: 150, top: "55%" },
  { id: "slim", label: "Slim can", img: slimImg, stickerSize: 110, top: "55%" },
  { id: "water", label: "Water bottle", img: waterImg, stickerSize: 130, top: "55%" },
  { id: "jar", label: "Mason jar", img: jarImg, stickerSize: 150, top: "60%" },
];

function PreviewPage() {
  const s = useStudio();
  const active = CONTAINERS.find((c) => c.id === s.container) ?? CONTAINERS[0];

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-8 lg:gap-12">
      <section>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Looks beautiful in real life</h1>
        <p className="mt-1 text-muted-foreground text-sm">Swipe to try it on different containers.</p>

        <div className="mt-6 relative rounded-3xl bg-gradient-to-b from-muted/40 to-card border border-border/60 shadow-soft overflow-hidden aspect-[4/5] sm:aspect-[5/4] flex items-center justify-center">
          <img
            src={active.img}
            alt={active.label}
            className="absolute inset-0 h-full w-full object-contain"
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ top: active.top, filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.18))" }}
          >
            <div style={{ transform: "perspective(600px) rotateY(-6deg)" }}>
              <StickerArtwork
                imageUrl={s.imageUrl}
                shape={s.shape}
                textLayers={s.textLayers}
                whiteBorder={s.whiteBorder}
                container={s.container}
                volume={s.volume}
                size={active.stickerSize}
              />
            </div>
          </div>
        </div>
        <LabelDimsCaption container={s.container} volume={s.volume} shape={s.shape} />

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 -mx-2 px-2">
          {CONTAINERS.map((c) => (
            <button
              key={c.id}
              onClick={() => s.setContainer(c.id)}
              className={[
                "shrink-0 rounded-2xl border p-1.5 transition-all bg-card",
                s.container === c.id ? "border-primary shadow-sm" : "border-border hover:border-primary/40",
              ].join(" ")}
            >
              <div className="h-16 w-14 rounded-xl overflow-hidden bg-muted">
                <img src={c.img} alt={c.label} className="h-full w-full object-contain" />
              </div>
              <p className="text-[10px] mt-1 text-center text-muted-foreground">{c.label}</p>
            </button>
          ))}
        </div>
      </section>

      <aside className="lg:sticky lg:top-28 self-start space-y-4">
        <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/60">
          <h2 className="font-semibold">Happy with it?</h2>
          <p className="text-sm text-muted-foreground mt-1">Download print-ready files for free, or order physical stickers shipped to your door.</p>
          <Button asChild size="lg" className="w-full mt-5 rounded-full shadow-glow bg-gradient-sage text-primary-foreground hover:opacity-95">
            <Link to="/studio/checkout">Continue <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
          <Button variant="ghost" asChild className="w-full mt-2 rounded-full">
            <Link to="/studio/customize"><ArrowLeft className="h-4 w-4 mr-1" /> Back to edit</Link>
          </Button>
        </div>
      </aside>
    </div>
  );
}
