import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { selectGelatoProduct } from "@/lib/gelato-products";

const Input = z.object({
  artworkUrl: z.string().url(),
  quantity: z.number().int().min(1).max(10000),
  size: z.enum(["2in", "3in", "4in", "5in", "small", "large"]),
  container: z.string().nullable(),
  shape: z.string(),
  totalCents: z.number().int().min(50),
  shippingMethod: z.string().max(120),
  shippingMethodUid: z.string().nullable().optional(),
  recipient: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    addressLine1: z.string().min(1).max(255),
    addressLine2: z.string().max(255).optional(),
    city: z.string().min(1).max(100),
    postCode: z.string().min(1).max(20),
    country: z.string().length(2),
    state: z.string().max(100).optional(),
    email: z.string().email(),
    phone: z.string().max(30).optional(),
  }),
  returnUrl: z.string().url(),
});

const GATEWAY = "https://connector-gateway.lovable.dev/stripe";

async function stripeFetch(path: string, params: Record<string, string>) {
  const key = process.env.STRIPE_SANDBOX_API_KEY || process.env.STRIPE_LIVE_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!key || !lovableKey) throw new Error("Stripe gateway not configured");

  const body = new URLSearchParams(params);
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Connection-Api-Key": key,
      "Lovable-API-Key": lovableKey,
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Stripe error:", res.status, data);
    throw new Error(data?.error?.message || `Stripe error (${res.status})`);
  }
  return data;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const customerEmail = (claims as { email?: string }).email || data.recipient.email;

    const sku = selectGelatoProduct({
      container: data.container,
      shape: data.shape,
      size: data.size,
    });
    if (!sku) throw new Error("No Gelato product for this configuration");

    const { data: orderRow, error: insErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        status: "pending",
        customer_email: customerEmail,
        artwork_url: data.artworkUrl,
        gelato_product_uid: sku.productUid,
        quantity: data.quantity,
        size: data.size,
        recipient: data.recipient,
        shipping_method: data.shippingMethod,
        total_cents: data.totalCents,
        currency: "eur",
        metadata: {
          shippingMethodUid: data.shippingMethodUid ?? null,
          container: data.container,
          shape: data.shape,
        },
      })
      .select("id")
      .single();

    if (insErr || !orderRow) {
      console.error("Insert order failed:", insErr);
      throw new Error("Could not create order");
    }

    const env = process.env.STRIPE_SANDBOX_API_KEY ? "sandbox" : "live";
    const returnUrl = `${data.returnUrl}?session_id={CHECKOUT_SESSION_ID}&order_id=${orderRow.id}`;

    const session = await stripeFetch("/v1/checkout/sessions", {
      "ui_mode": "embedded",
      "mode": "payment",
      "customer_email": customerEmail,
      "return_url": returnUrl,
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][product_data][name]": `Custom ${sku.label}`,
      "line_items[0][price_data][product_data][description]": `Quantity ${data.quantity} • ${data.shippingMethod}`,
      "line_items[0][price_data][unit_amount]": String(data.totalCents),
      "line_items[0][quantity]": "1",
      "metadata[orderId]": orderRow.id,
      "metadata[userId]": userId,
      "metadata[environment]": env,
      "payment_intent_data[metadata][orderId]": orderRow.id,
      "payment_intent_data[metadata][userId]": userId,
    });

    await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderRow.id);

    return {
      clientSecret: session.client_secret as string,
      orderId: orderRow.id,
    };
  });
