// supabase/functions/payments-webhook/index.ts
// Receives Stripe webhook events. On checkout.session.completed → marks order
// paid and creates the Gelato print order via the public Gelato webhook helper.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type StripeEnv = "sandbox" | "live";

async function verifyWebhook(req: Request, env: StripeEnv) {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret = env === "sandbox"
    ? Deno.env.get("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
    : Deno.env.get("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!secret) throw new Error("Webhook secret not configured");
  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));
  if (!v1Signatures.includes(expected)) throw new Error("Invalid signature");

  return JSON.parse(body);
}

const GELATO_BASE = "https://order.gelatoapis.com";

async function createGelatoOrder(orderId: string) {
  const apiKey = Deno.env.get("GELATO_API_KEY");
  if (!apiKey) throw new Error("GELATO_API_KEY not configured");

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (error || !order) throw new Error("Order not found");
  if (order.gelato_order_id) {
    console.log("Order already fulfilled by Gelato:", order.gelato_order_id);
    return;
  }

  const recipient = order.recipient as Record<string, string>;
  const meta = (order.metadata || {}) as Record<string, string | null>;

  const res = await fetch(`${GELATO_BASE}/v4/orders`, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      orderReferenceId: order.id,
      customerReferenceId: order.customer_email,
      currency: (order.currency || "eur").toUpperCase(),
      orderType: "order",
      recipient: {
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        addressLine1: recipient.addressLine1,
        addressLine2: recipient.addressLine2,
        city: recipient.city,
        postCode: recipient.postCode,
        country: recipient.country,
        state: recipient.state,
        email: order.customer_email,
        phone: recipient.phone,
      },
      ...(meta.shippingMethodUid && { shipmentMethodUid: meta.shippingMethodUid }),
      items: [
        {
          itemReferenceId: `${order.id}-1`,
          productUid: order.gelato_product_uid,
          quantity: order.quantity,
          files: [{ type: "default", url: order.artwork_url }],
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Gelato create order failed:", res.status, data);
    await supabase
      .from("orders")
      .update({ status: "fulfillment_failed", metadata: { ...meta, gelatoError: data } })
      .eq("id", orderId);
    return;
  }

  await supabase
    .from("orders")
    .update({
      status: "submitted",
      gelato_order_id: data.id ?? data.orderId ?? null,
    })
    .eq("id", orderId);

  console.log("Gelato order created:", data.id);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "sandbox") as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("Stripe event:", event.type, "env:", env);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (!orderId) {
        console.error("No orderId in session metadata");
        return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
      }

      // Mark paid
      await supabase
        .from("orders")
        .update({ status: "paid" })
        .eq("id", orderId);

      // Trigger Gelato fulfillment
      try {
        await createGelatoOrder(orderId);
      } catch (e) {
        console.error("Gelato fulfillment error:", e);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
