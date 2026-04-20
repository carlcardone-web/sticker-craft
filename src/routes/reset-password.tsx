import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — Sticker Studio" }] }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated.");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl bg-card border border-border/60 shadow-soft p-8 space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Set new password</h1>
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 rounded-xl" />
        </div>
        <Button type="submit" disabled={loading} className="w-full rounded-full">
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
