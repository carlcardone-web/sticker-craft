import { Link, useRouterState } from "@tanstack/react-router";
import { STEPS } from "@/lib/studio-store";
import { Check } from "lucide-react";

export function StepIndicator() {
  const { location } = useRouterState();
  const currentIdx = STEPS.findIndex((s) => location.pathname.startsWith(s.path));
  const current = currentIdx === -1 ? 0 : currentIdx;

  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.id} className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0">
              <Link
                to={step.path}
                className="flex items-center gap-2 group min-w-0"
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={[
                    "flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full text-xs sm:text-sm font-medium transition-all duration-300",
                    done
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : active
                        ? "bg-primary text-primary-foreground shadow-glow"
                        : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {done ? <Check className="h-4 w-4" /> : step.id}
                </span>
                <span
                  className={[
                    "text-xs sm:text-sm truncate transition-colors",
                    active ? "text-foreground font-medium" : "text-muted-foreground",
                    "hidden sm:inline",
                  ].join(" ")}
                >
                  {step.label}
                </span>
              </Link>
              {i < STEPS.length - 1 && (
                <span
                  className={[
                    "h-px flex-1 transition-colors duration-500",
                    i < current ? "bg-primary" : "bg-border",
                  ].join(" ")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
