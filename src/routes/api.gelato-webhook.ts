import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gelatoCreateOrder } from "@/server/gelato.server";

const SignaturePayload = z.object({
  event: z.string(),
  orderReferenceId: z.string().optional(),
  fulfillments: z.array(z.any()).optional(),
  items: z.array(z.any()).optional(),
});

/**
 * Gelato webhook receiver. Configure in Gelato dashboard → Settings → Webhooks
 * pointing at:  https://<your-domain>/api/gelato-webhook
 *
 * Header used for verification: `gelato-webhook-secret` must match GELATO_WEBHOOK_SECRET.
 * (Gelato's signature scheme; if you're using their HMAC variant, swap the check.)
 */
export const Route = createFileRoute("/api/gelato-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.GELATO_WEBHOOK_SECRET;
        if (secret) {
          const provided = request.headers.get("gelato-webhook-secret");
          if (provided !== secret) {
            return new Response("Unauthorized", { status: 401 });
          }
        }

        let parsed: any;
        try {
          parsed = await request.json();
          SignaturePayload.parse(parsed);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const orderRefId = parsed.orderReferenceId;
        if (!orderRefId) return new Response(JSON.stringify({ ok: true }), { status: 200 });

        // orderReferenceId we set in createGelatoOrder is the local order UUID
        const eventName = String(parsed.event || "").toLowerCase();
        const update: {
          status?: string;
          tracking_url?: string;
          tracking_carrier?: string;
        } = {};

        if (eventName.includes("printed")) update.status = "printed";
        else if (eventName.includes("shipped")) update.status = "shipped";
        else if (eventName.includes("delivered")) update.status = "delivered";
        else if (eventName.includes("canceled")) update.status = "canceled";
        else if (eventName.includes("failed")) update.status = "failed";
        else if (eventName.includes("printing")) update.status = "printing";

        // Tracking info
        const fulfillments = parsed.fulfillments ?? parsed.items?.[0]?.fulfillments ?? [];
        const f0 = fulfillments?.[0];
        if (f0?.trackingUrl) update.tracking_url = f0.trackingUrl;
        if (f0?.shipmentMethodName) update.tracking_carrier = f0.shipmentMethodName;

        if (Object.keys(update).length === 0) {
          return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
        }

        const { error } = await supabaseAdmin
          .from("orders")
          .update(update)
          .eq("id", orderRefId);

        if (error) {
          console.error("Gelato webhook update failed:", error);
          return new Response("DB error", { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

// Re-export so we can call it from Stripe webhook to fulfill orders
export async function fulfillGelatoOrder(orderId: string) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (error || !order) throw new Error("Order not found");
  if (order.gelato_order_id) return { alreadyFulfilled: true, gelatoOrderId: order.gelato_order_id };

  const recipient = order.recipient as any;
  const meta = (order.metadata || {}) as any;

  const result = await gelatoCreateOrder({
    orderReferenceId: order.id,
    currency: "EUR",
    shippingMethodUid: meta.shippingMethodUid ?? undefined,
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
    items: [
      {
        itemReferenceId: `${order.id}-1`,
        productUid: order.gelato_product_uid,
        quantity: order.quantity,
        files: [{ type: "default", url: order.artwork_url }],
      },
    ],
  });

  await supabaseAdmin
    .from("orders")
    .update({
      status: "submitted",
      gelato_order_id: result.id ?? result.orderId ?? null,
    })
    .eq("id", orderId);

  return { alreadyFulfilled: false, gelatoOrderId: result.id ?? result.orderId };
}
