import { Link, Outlet } from "@tanstack/react-router";
import { StepIndicator } from "./StepIndicator";

export function StudioLayout() {
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
