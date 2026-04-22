import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ContainerPreviewScene, getContainerMockup, getLabelCaption } from "@/components/studio/ContainerPreviewScene";
import { Button } from "@/components/ui/button";
import { CONTAINER_CHOICES, useStudio } from "@/lib/studio-store";

export const Route = createFileRoute("/studio/preview")({
  head: () => ({
    meta: [
      { title: "Preview on bottles & cans — Sticker Studio" },
      { name: "description", content: "See your sticker on real containers." },
    ],
  }),
  component: PreviewPage,
});

function PreviewPage() {
  const studio = useStudio();
  const active = getContainerMockup(studio.container);
  const caption = getLabelCaption(studio.container, studio.volume, studio.shape);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:gap-12">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Looks beautiful in real life</h1>
        <p className="mt-1 text-sm text-muted-foreground">Swipe to try it on different containers.</p>

        <div className="mt-6">
          <ContainerPreviewScene
            imageUrl={studio.imageUrl}
            shape={studio.shape}
            textLayers={studio.textLayers}
            whiteBorder={studio.whiteBorder}
            container={studio.container}
            volume={studio.volume}
            imageTransform={studio.imageTransform}
          />
        </div>
        {caption ? <p className="mt-3 text-center text-xs tabular-nums text-muted-foreground">{caption}</p> : null}

        <div className="-mx-2 mt-5 flex gap-2 overflow-x-auto px-2 pb-1">
          {CONTAINER_CHOICES.map((container) => {
            const mockup = getContainerMockup(container.id);
            return (
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
                  <img src={mockup.image} alt={container.label} className="h-full w-full object-contain" />
                </div>
                <p className="mt-1 text-center text-[10px] text-muted-foreground">{container.label}</p>
              </button>
            );
          })}
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
