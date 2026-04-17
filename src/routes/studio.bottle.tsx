import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BOTTLE_VOLUMES, CONTAINER_CHOICES, useStudio } from "@/lib/studio-store";
import { ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/studio/bottle")({
  head: () => ({
    meta: [
      { title: "Choose your bottle — Sticker Studio" },
      { name: "description", content: "Pick the bottle or can you're labelling and the size you'll use." },
    ],
  }),
  component: BottlePage,
});

function BottlePage() {
  const { container, setContainer, volume, setVolume } = useStudio();
  const navigate = useNavigate();
  const activeContainer = CONTAINER_CHOICES.find((c) => c.id === container);
  const volumes = container ? BOTTLE_VOLUMES[container] ?? [] : [];

  function pickContainer(id: string) {
    setContainer(id);
    if (BOTTLE_VOLUMES[id] && !BOTTLE_VOLUMES[id].includes(volume ?? "")) {
      setVolume(null);
    }
  }

  function handleContinue() {
    if (!container || !volume) return;
    navigate({ to: "/studio/create" });
  }

  return (
    <div className="max-w-4xl mx-auto">
      <header className="text-center">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {!activeContainer ? "Which bottle are you labelling?" : "What size?"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {!activeContainer
            ? "Pick the container so we can plan the right label proportions."
            : `Choose a standard ${activeContainer.label.toLowerCase()} size.`}
        </p>
      </header>

      {/* Stage A — container picker */}
      <section className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {CONTAINER_CHOICES.map((c) => {
          const active = c.id === container;
          return (
            <button
              key={c.id}
              onClick={() => pickContainer(c.id)}
              className={[
                "group relative flex flex-col items-center text-center gap-2 rounded-3xl border bg-card p-6 transition-all",
                active
                  ? "border-primary shadow-glow ring-2 ring-primary/30"
                  : "border-border/60 hover:border-primary/40 hover:shadow-soft",
              ].join(" ")}
            >
              {active && (
                <span className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              <span className="text-4xl" aria-hidden>{c.emoji}</span>
              <span className="font-semibold">{c.label}</span>
              <span className="text-xs text-muted-foreground">{c.tagline}</span>
            </button>
          );
        })}
      </section>

      {/* Stage B — volume picker */}
      {activeContainer && (
        <section className="mt-10 rounded-3xl bg-card border border-border/60 p-6 shadow-soft animate-fade-up">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-2xl shrink-0" aria-hidden>{activeContainer.emoji}</span>
              <div className="min-w-0">
                <p className="font-semibold truncate">{activeContainer.label}</p>
                <p className="text-xs text-muted-foreground">Pick a standard volume</p>
              </div>
            </div>
            <button
              onClick={() => { setContainer(null); setVolume(null); }}
              className="text-sm text-primary hover:underline shrink-0"
            >
              Change
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {volumes.map((v) => {
              const active = v === volume;
              return (
                <button
                  key={v}
                  onClick={() => setVolume(v)}
                  className={[
                    "py-3 rounded-2xl border text-sm font-semibold transition-all",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background hover:border-primary/40",
                  ].join(" ")}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-8 flex justify-between items-center gap-3">
        <Button variant="ghost" asChild className="rounded-full">
          <Link to="/">Cancel</Link>
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!container || !volume}
          size="lg"
          className="rounded-full px-7 shadow-glow bg-gradient-sage text-primary-foreground hover:opacity-95"
        >
          Continue <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}
