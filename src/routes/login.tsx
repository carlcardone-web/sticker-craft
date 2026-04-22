import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { z } from "zod";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function sanitizeRedirect(r: unknown): string | undefined {
  if (typeof r !== "string" || !r) return undefined;
  // Only allow internal paths, never absolute URLs, never auth pages themselves.
  if (!r.startsWith("/")) return undefined;
  if (r.startsWith("//")) return undefined;
  if (r.startsWith("/login") || r.startsWith("/signup")) return undefined;
  return r;
}

const searchSchema = z.object({
  redirect: z.string().optional().transform(sanitizeRedirect),
});

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Sticker Studio" }] }),
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Bounce already-authenticated users away from the login page.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate({ to: (redirect as any) || "/", replace: true });
    }
  }, [authLoading, isAuthenticated, redirect, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: (redirect as any) || "/", replace: true });
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + (redirect || "/"),
      extraParams: {
        prompt: "select_account",
      },
    });

    if (result.redirected) return;
    if (result.error) {
      toast.error("Google sign-in is unavailable right now. You can still use email and password.");
      return;
    }

    toast.success("Welcome back!");
    navigate({ to: (redirect as any) || "/", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border/60 shadow-soft p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to complete your order.</p>

        <Button onClick={handleGoogle} variant="outline" className="w-full mt-6 rounded-full">
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> or <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 rounded-xl" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-muted-foreground hover:underline">Forgot?</Link>
            </div>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 rounded-xl" />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-full mt-2">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-center text-muted-foreground">
          New here? <Link to="/signup" search={{ redirect } as any} className="text-foreground font-medium hover:underline">Create account</Link>
        </p>
      </div>
    </div>
  );
}
