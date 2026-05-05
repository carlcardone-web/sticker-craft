import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CONTAINER_CHOICES, useStudio } from "@/lib/studio-store";
import { composeMockup } from "@/server/compose-mockup";

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
  const [mockups, setMockups] = useState<Record<string, string>>({});
  const [loadingFor, setLoadingFor] = useState<string | null>(null);
  const inflight = useRef<Set<string>>(new Set());

  const activeContainer = studio.container ?? "wine";
  const activeMockup = mockups[activeContainer] ?? null;

  async function generateFor(container: string) {
    if (!studio.imageUrl) return;
    if (mockups[container] || inflight.current.has(container)) return;
    inflight.current.add(container);
    setLoadingFor(container);
    try {
      const res = await composeMockup({
        data: {
          artworkUrl: studio.imageUrl,
          container,
          volume: studio.volume,
        },
      });
      setMockups((prev) => ({ ...prev, [container]: res.imageUrl }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Mockup generation failed";
      toast.error(msg);
    } finally {
      inflight.current.delete(container);
      setLoadingFor((curr) => (curr === container ? null : curr));
    }
  }

  // Auto-generate for the active container when it changes
  useEffect(() => {
    if (studio.imageUrl) generateFor(activeContainer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContainer, studio.imageUrl]);

  const isLoading = loadingFor === activeContainer && !activeMockup;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:gap-12">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Looks beautiful in real life</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We're rendering your sticker onto a real {CONTAINER_CHOICES.find((c) => c.id === activeContainer)?.label.toLowerCase() ?? "container"}.
        </p>

        <div className="relative mt-6 flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-muted/40 to-card sm:aspect-[5/4]">
          {activeMockup ? (
            <img
              src={activeMockup}
              alt={`Your sticker on a ${activeContainer}`}
              className="h-full w-full object-contain"
            />
          ) : isLoading ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Rendering a realistic mockup… this can take ~30s.</p>
            </div>
          ) : studio.imageUrl ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <p className="text-sm">No preview yet.</p>
              <Button size="sm" onClick={() => generateFor(activeContainer)} className="rounded-full">
                Generate preview
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Generate a sticker first.</p>
          )}

          {activeMockup && (
            <button
              type="button"
              onClick={() => {
                setMockups((prev) => {
                  const next = { ...prev };
                  delete next[activeContainer];
                  return next;
                });
                generateFor(activeContainer);
              }}
              className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-card"
              title="Generate a fresh mockup"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
            </button>
          )}
        </div>

        <div className="-mx-2 mt-5 flex gap-2 overflow-x-auto px-2 pb-1">
          {CONTAINER_CHOICES.map((container) => {
            const isActive = activeContainer === container.id;
            const thumb = mockups[container.id];
            return (
              <button
                key={container.id}
                type="button"
                onClick={() => studio.setContainer(container.id)}
                className={[
                  "shrink-0 rounded-2xl border bg-card p-1.5 transition-all",
                  isActive ? "border-primary shadow-sm" : "border-border hover:border-primary/40",
                ].join(" ")}
              >
                <div className="flex h-16 w-14 items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {thumb ? (
                    <img src={thumb} alt={container.label} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-2xl" aria-hidden>{container.emoji}</span>
                  )}
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
