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
    return <Navigate to="/login" search={{ redirect: location.href } as any} />;
  }

  return <>{children}</>;
}
