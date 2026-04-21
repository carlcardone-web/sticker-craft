import { useAuth } from "@/lib/auth-context";
import { Navigate, useLocation } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Use a relative path (no protocol/host) and avoid sending users back to
    // an auth page, which would create a self-referential redirect loop.
    const path = location.pathname + (location.searchStr || "");
    const safeRedirect =
      path && !path.startsWith("/login") && !path.startsWith("/signup")
        ? path
        : undefined;
    return (
      <Navigate
        to="/login"
        search={(safeRedirect ? { redirect: safeRedirect } : {}) as any}
        replace
      />
    );
  }

  return <>{children}</>;
}
