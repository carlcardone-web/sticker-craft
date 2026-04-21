import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStudio } from "@/lib/studio-store";
import { StickerArtwork } from "@/components/studio/StickerArtwork";
import { getSizeOptionsFor, type StickerSize, type LabelSize } from "@/lib/gelato-products";
import { quoteOrder } from "@/server/quote-order.functions";
import { createCheckoutSession } from "@/server/create-checkout.functions";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { Package, Truck, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/studio/checkout")({
  head: () => ({
    meta: [
      { title: "Order — Sticker Studio" },
      { name: "description", content: "Get a live shipping quote and order your custom stickers." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <CheckoutPage />
    </RequireAuth>
  ),
});

const QUANTITIES = [25, 50, 100, 250];

type Quote = Awaited<ReturnType<typeof quoteOrder>>;

function CheckoutPage() {
  const s = useStudio();
  const { user } = useAuth();
  const navigate = useNavigate();
  const quoteFn = useServerFn(quoteOrder);
  const checkoutFn = useServerFn(createCheckoutSession);

  const sizeOptions = useMemo(() => getSizeOptionsFor(s.container), [s.container]);
  const [size, setSize] = useState<StickerSize | LabelSize>(sizeOptions[0]?.id ?? "3in");
  const [qty, setQty] = useState(50);

  const [recipient, setRecipient] = useState({
    firstName: "",
    lastName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postCode: "",
    country: "DE",
    state: "",
    email: user?.email ?? "",
    phone: "",
  });

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const artworkUsable = !!s.imageUrl?.startsWith("https://");

  async function handleGetQuote() {
    if (!s.imageUrl) return toast.error("Generate your sticker first.");
    if (!artworkUsable) {
      return toast.error(
        "Your artwork must be a public HTTPS URL. Please regenerate your sticker.",
      );
    }
    setLoading(true);
    try {
      const q = await quoteFn({
        data: {
          artworkUrl: s.imageUrl!,
          quantity: qty,
          size,
          container: s.container,
          shape: s.shape,
          recipient,
        },
      });
      setQuote(q);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to get quote");
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    if (!quote) return;
    setLoading(true);
    try {
      const result = await checkoutFn({
        data: {
          artworkUrl: s.imageUrl!,
          quantity: qty,
          size,
          container: s.container,
          shape: s.shape,
          totalCents: quote.totalCents,
          shippingMethod: quote.shippingMethod,
          shippingMethodUid: quote.shippingMethodUid,
          recipient,
          returnUrl: `${window.location.origin}/studio/return`,
        },
      });
      setClientSecret(result.clientSecret);
      setOrderId(result.orderId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  if (clientSecret) {
    return (
      <div className="max-w-xl mx-auto rounded-3xl bg-card border border-border/60 shadow-soft p-4">
        <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-8 lg:gap-12">
      <section className="rounded-3xl bg-card p-8 shadow-soft border border-border/60 flex flex-col items-center justify-center">
        <StickerArtwork
          imageUrl={s.imageUrl}
          shape={s.shape}
          textLayers={s.textLayers}
          whiteBorder={s.whiteBorder}
          container={s.container}
          volume={s.volume}
          size={300}
          showDimensions
          imageTransform={s.imageTransform}
        />
        <p className="mt-6 text-sm text-muted-foreground">Your sticker is ready.</p>
        {!artworkUsable && (
          <div className="mt-3 flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-xl p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>Artwork URL is not a public HTTPS URL. Please regenerate to enable ordering.</p>
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="rounded-3xl bg-card border border-border/60 shadow-soft p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-sage flex items-center justify-center text-primary-foreground">
              <Package className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Order printed stickers</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Pro-quality vinyl, shipped via Gelato.</p>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quantity</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {QUANTITIES.map((q) => (
                <button
                  key={q}
                  onClick={() => { setQty(q); setQuote(null); }}
                  className={[
                    "py-2.5 rounded-xl text-sm font-medium border transition-all",
                    qty === q ? "border-primary bg-primary-soft" : "border-border bg-background hover:border-primary/40",
                  ].join(" ")}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Size</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {sizeOptions.map((sz) => (
                <button
                  key={sz.id}
                  onClick={() => { setSize(sz.id); setQuote(null); }}
                  className={[
                    "py-2.5 px-3 rounded-xl text-sm font-medium border transition-all text-left",
                    size === sz.id ? "border-primary bg-primary-soft" : "border-border bg-background hover:border-primary/40",
                  ].join(" ")}
                >
                  <div>{sz.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{sz.dimensions}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Ship to</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="First name" className="rounded-xl" value={recipient.firstName} onChange={(e) => setRecipient({ ...recipient, firstName: e.target.value })} />
              <Input placeholder="Last name" className="rounded-xl" value={recipient.lastName} onChange={(e) => setRecipient({ ...recipient, lastName: e.target.value })} />
            </div>
            <Input placeholder="Email" type="email" className="rounded-xl" value={recipient.email} onChange={(e) => setRecipient({ ...recipient, email: e.target.value })} />
            <Input placeholder="Street address" className="rounded-xl" value={recipient.addressLine1} onChange={(e) => setRecipient({ ...recipient, addressLine1: e.target.value })} />
            <Input placeholder="Apt/Suite (optional)" className="rounded-xl" value={recipient.addressLine2} onChange={(e) => setRecipient({ ...recipient, addressLine2: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="City" className="rounded-xl" value={recipient.city} onChange={(e) => setRecipient({ ...recipient, city: e.target.value })} />
              <Input placeholder="Postal code" className="rounded-xl" value={recipient.postCode} onChange={(e) => setRecipient({ ...recipient, postCode: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Country (ISO-2 e.g. DE)" maxLength={2} className="rounded-xl uppercase" value={recipient.country} onChange={(e) => setRecipient({ ...recipient, country: e.target.value.toUpperCase() })} />
              <Input placeholder="State (optional)" className="rounded-xl" value={recipient.state} onChange={(e) => setRecipient({ ...recipient, state: e.target.value })} />
            </div>
          </div>

          {quote ? (
            <div className="border-t border-border/60 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">€{quote.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> {quote.shippingMethod}</span>
                <span className="tabular-nums">€{quote.shippingPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border/60">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums">€{(quote.totalCents / 100).toFixed(2)}</span>
              </div>
              <Button
                size="lg"
                disabled={loading || !artworkUsable}
                onClick={handlePay}
                className="w-full rounded-full shadow-glow bg-gradient-sage text-primary-foreground hover:opacity-95 mt-2"
              >
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…</> : `Pay €${(quote.totalCents / 100).toFixed(2)}`}
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              disabled={loading || !artworkUsable || !recipient.firstName || !recipient.email || !recipient.addressLine1 || !recipient.city || !recipient.postCode || recipient.country.length !== 2}
              onClick={handleGetQuote}
              className="w-full rounded-full mt-2"
              variant="outline"
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Quoting…</> : "Get live quote"}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
