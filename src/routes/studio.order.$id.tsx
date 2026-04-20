import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Check, Package, Truck, Printer, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/studio/order/$id")({
  head: () => ({ meta: [{ title: "Order status — Sticker Studio" }] }),
  component: () => (
    <RequireAuth>
      <OrderPage />
    </RequireAuth>
  ),
});

type OrderRow = {
  id: string;
  status: string;
  customer_email: string;
  artwork_url: string;
  quantity: number;
  size: string;
  total_cents: number;
  currency: string;
  tracking_url: string | null;
  tracking_carrier: string | null;
  gelato_order_id: string | null;
  recipient: any;
  created_at: string;
};

const STAGES = [
  { key: "paid", label: "Payment received", icon: Check },
  { key: "submitted", label: "Sent to printer", icon: Printer },
  { key: "printing", label: "Printing", icon: Printer },
  { key: "printed", label: "Printed", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Check },
];

function stageIndex(status: string): number {
  const map: Record<string, number> = {
    pending: -1,
    paid: 0,
    submitted: 1,
    printing: 2,
    printed: 3,
    shipped: 4,
    delivered: 5,
    failed: -1,
    fulfillment_failed: -1,
    canceled: -1,
  };
  return map[status] ?? -1;
}

function OrderPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (error) setErr(error.message);
      else setOrder(data as OrderRow);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => {
          setOrder(payload.new as OrderRow);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (err || !order) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
        <p className="mt-4">{err || "Order not found"}</p>
        <Button asChild variant="outline" className="mt-4 rounded-full">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  }

  const idx = stageIndex(order.status);
  const isFailed = ["failed", "fulfillment_failed", "canceled"].includes(order.status);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-3xl bg-card border border-border/60 shadow-soft p-8">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Order #{order.id.slice(0, 8)}</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">
          {isFailed ? "Order needs attention" : idx >= 5 ? "Delivered 🎉" : idx >= 4 ? "On its way" : idx >= 1 ? "In production" : "Payment confirmed"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {order.quantity} × {order.size} • €{(order.total_cents / 100).toFixed(2)}
        </p>

        <div className="mt-6 flex items-start gap-4">
          <img src={order.artwork_url} alt="Your sticker" className="h-24 w-24 rounded-2xl object-contain bg-muted" />
          <div className="flex-1 text-sm">
            <p className="font-medium">Shipping to</p>
            <p className="text-muted-foreground mt-1">
              {order.recipient.firstName} {order.recipient.lastName}<br />
              {order.recipient.addressLine1}{order.recipient.addressLine2 ? `, ${order.recipient.addressLine2}` : ""}<br />
              {order.recipient.city}, {order.recipient.postCode}, {order.recipient.country}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-card border border-border/60 shadow-soft p-8">
        <h2 className="font-semibold">Status</h2>
        <ol className="mt-5 space-y-4">
          {STAGES.map((stage, i) => {
            const done = i <= idx;
            const current = i === idx;
            const Icon = stage.icon;
            return (
              <li key={stage.key} className="flex items-center gap-3">
                <div className={[
                  "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                  done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                ].join(" ")}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={done ? "font-medium" : "text-muted-foreground"}>{stage.label}</span>
                {current && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />}
              </li>
            );
          })}
        </ol>

        {order.tracking_url && (
          <a
            href={order.tracking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center justify-center gap-2 w-full rounded-full border border-border bg-background hover:border-primary/40 transition-all py-2.5 text-sm font-medium"
          >
            Track shipment {order.tracking_carrier ? `(${order.tracking_carrier})` : ""} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {isFailed && (
          <div className="mt-6 rounded-xl bg-destructive/10 text-destructive p-4 text-sm">
            Something went wrong with this order. We'll be in touch — please reach out if you don't hear from us within 24h.
          </div>
        )}
      </div>

      <div className="text-center">
        <Button asChild variant="ghost" className="rounded-full">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
