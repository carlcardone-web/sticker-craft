import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

const searchSchema = z.object({
  session_id: z.string().optional(),
  order_id: z.string().optional(),
});

export const Route = createFileRoute("/studio/return")({
  head: () => ({ meta: [{ title: "Processing order…" }] }),
  validateSearch: searchSchema,
  component: ReturnPage,
});

function ReturnPage() {
  const { order_id } = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    if (order_id) {
      navigate({ to: "/studio/order/$id", params: { id: order_id } });
    }
  }, [order_id, navigate]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="mt-4">Confirming your order…</p>
      {!order_id && (
        <Link to="/" className="mt-4 underline text-sm">Return home</Link>
      )}
    </div>
  );
}
