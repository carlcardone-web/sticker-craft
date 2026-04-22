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
  if (!r.startsWith("/")) return undefined;
  if (r.startsWith("//")) return undefined;
  if (r.startsWith("/login") || r.startsWith("/signup")) return undefined;
  return r;
}

const searchSchema = z.object({
  redirect: z.string().optional().transform(sanitizeRedirect),
});

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — Sticker Studio" }] }),
  validateSearch: searchSchema,
  component: SignupPage,
});

function SignupPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate({ to: (redirect as any) || "/", replace: true });
    }
  }, [authLoading, isAuthenticated, redirect, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: name },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Check your email to confirm your account.");
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
      toast.error("Google sign-in is unavailable right now. You can still create an account with email.");
      return;
    }

    toast.success("Account created.");
    navigate({ to: (redirect as any) || "/", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border/60 shadow-soft p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Save your designs and orders.</p>

        <Button onClick={handleGoogle} variant="outline" className="w-full mt-6 rounded-full">
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> or <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 rounded-xl" />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-full mt-2">
            {loading ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-center text-muted-foreground">
          Have an account? <Link to="/login" search={{ redirect } as any} className="text-foreground font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
