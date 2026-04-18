import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { StepIndicator } from "./StepIndicator";
import { useStudio } from "@/lib/studio-store";

export function StudioLayout() {
  const reset = useStudio((s) => s.reset);
  const navigate = useNavigate();

  function handleReset() {
    if (typeof window === "undefined") return;
    if (!window.confirm("Start over? This clears your bottle, prompt, references, and design.")) return;
    reset();
    try {
      window.localStorage.removeItem("lovable-studio-v1");
    } catch {
      /* ignore */
    }
    navigate({ to: "/studio/bottle" });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 glass border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-4 sm:gap-8">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="h-7 w-7 rounded-full bg-gradient-sage shadow-glow" />
            <span className="font-semibold tracking-tight">Sticker Studio</span>
          </Link>
          <div className="flex-1 min-w-0">
            <StepIndicator />
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            title="Start over and clear saved studio"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Start over</span>
          </button>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 animate-fade-up">
          <Outlet />
        </div>
      </main>
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Designed with care · Print-ready · No account needed
      </footer>
    </div>
  );
}
