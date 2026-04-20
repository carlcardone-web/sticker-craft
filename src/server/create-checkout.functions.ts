import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";
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

function getStripe() {
  // The Stripe gateway key works as a normal secret here because we're calling
  // stripe directly from a TanStack server fn (Worker runtime). Use sandbox key
  // until the project goes live.
  const key = process.env.STRIPE_SANDBOX_API_KEY || process.env.STRIPE_LIVE_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!key || !lovableKey) throw new Error("Stripe gateway not configured");

  return new Stripe(key, {
    apiVersion: "2024-06-20" as any,
    httpClient: Stripe.createFetchHttpClient((url: string | URL, init?: RequestInit) => {
      const gatewayUrl = url.toString().replace("https://api.stripe.com", "https://connector-gateway.lovable.dev/stripe");
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers).entries()),
          "X-Connection-Api-Key": key,
          "Lovable-API-Key": lovableKey,
        },
      });
    }),
  });
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const customerEmail = (claims as any).email || data.recipient.email;

    const sku = selectGelatoProduct({
      container: data.container,
      shape: data.shape,
      size: data.size,
    });
    if (!sku) throw new Error("No Gelato product for this configuration");

    // Insert pending order first so we have an id
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
          shippingMethodUid: data.shippingMethodUid,
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

    const stripe = getStripe();
    const env = process.env.STRIPE_SANDBOX_API_KEY ? "sandbox" : "live";

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "payment",
      customer_email: customerEmail,
      return_url: `${data.returnUrl}?session_id={CHECKOUT_SESSION_ID}&order_id=${orderRow.id}`,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Custom ${sku.label}`,
              description: `Quantity ${data.quantity} • Shipping: ${data.shippingMethod}`,
            },
            unit_amount: data.totalCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        orderId: orderRow.id,
        userId,
        environment: env,
      },
      payment_intent_data: {
        metadata: { orderId: orderRow.id, userId },
      },
    });

    // Store stripe session id on the order
    await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderRow.id);

    return {
      clientSecret: session.client_secret,
      orderId: orderRow.id,
    };
  });
