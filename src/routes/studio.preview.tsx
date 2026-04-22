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
  return <p className="mt-3 text-center text-xs tabular-nums text-muted-foreground">Label size: {w} × {h} cm</p>;
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
  const studio = useStudio();
  const active = CONTAINERS.find((container) => container.id === studio.container) ?? CONTAINERS[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:gap-12">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Looks beautiful in real life</h1>
        <p className="mt-1 text-sm text-muted-foreground">Swipe to try it on different containers.</p>

        <div className="relative mt-6 flex aspect-[4/5] items-center justify-center overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-muted/40 to-card shadow-soft sm:aspect-[5/4]">
          <img src={active.img} alt={active.label} className="absolute inset-0 h-full w-full object-contain" />
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ top: active.top, filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.18))" }}>
            <div style={{ transform: "perspective(600px) rotateY(-6deg)" }}>
              <StickerArtwork
                imageUrl={studio.imageUrl}
                shape={studio.shape}
                textLayers={studio.textLayers}
                whiteBorder={studio.whiteBorder}
                container={studio.container}
                volume={studio.volume}
                size={active.stickerSize}
                imageTransform={studio.imageTransform}
              />
            </div>
          </div>
        </div>
        <LabelDimsCaption container={studio.container} volume={studio.volume} shape={studio.shape} />

        <div className="-mx-2 mt-5 flex gap-2 overflow-x-auto px-2 pb-1">
          {CONTAINERS.map((container) => (
            <button
              key={container.id}
              type="button"
              onClick={() => studio.setContainer(container.id)}
              className={[
                "shrink-0 rounded-2xl border bg-card p-1.5 transition-all",
                studio.container === container.id ? "border-primary shadow-sm" : "border-border hover:border-primary/40",
              ].join(" ")}
            >
              <div className="h-16 w-14 overflow-hidden rounded-xl bg-muted">
                <img src={container.img} alt={container.label} className="h-full w-full object-contain" />
              </div>
              <p className="mt-1 text-center text-[10px] text-muted-foreground">{container.label}</p>
            </button>
          ))}
        </div>
      </section>

      <aside className="self-start space-y-4 lg:sticky lg:top-28">
        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
          <h2 className="font-semibold">Happy with it?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Download print-ready files for free, or order physical stickers shipped to your door.</p>
          <Button asChild size="lg" className="mt-5 w-full rounded-full bg-gradient-sage text-primary-foreground shadow-glow hover:opacity-95">
            <Link to="/studio/checkout">
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" asChild className="mt-2 w-full rounded-full">
            <Link to="/studio/create">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to edit
            </Link>
          </Button>
        </div>
      </aside>
    </div>
  );
}
