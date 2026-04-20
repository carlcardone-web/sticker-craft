import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gelatoQuote } from "@/server/gelato.server";
import { selectGelatoProduct } from "@/lib/gelato-products";

const QuoteInput = z.object({
  artworkUrl: z.string().url(),
  quantity: z.number().int().min(1).max(10000),
  size: z.enum(["2in", "3in", "4in", "5in", "small", "large"]),
  container: z.string().nullable(),
  shape: z.string(),
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
});

export const quoteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => QuoteInput.parse(input))
  .handler(async ({ data }) => {
    const sku = selectGelatoProduct({
      container: data.container,
      shape: data.shape,
      size: data.size,
    });
    if (!sku) throw new Error("No matching Gelato product");

    if (!data.artworkUrl.startsWith("https://")) {
      throw new Error(
        "Artwork URL must be a public HTTPS URL. Please regenerate or upload your sticker.",
      );
    }

    try {
      const quote = await gelatoQuote({
        recipient: data.recipient,
        currency: "EUR",
        items: [
          {
            itemReferenceId: "item-1",
            productUid: sku.productUid,
            files: [{ type: "default", url: data.artworkUrl }],
            quantity: data.quantity,
          },
        ],
      });

      // Pull subtotal + cheapest shipping from response
      const productPrice = Number(quote?.productAndShippingPrices?.[0]?.products?.[0]?.itemPrice ?? 0);
      const shipping = quote?.productAndShippingPrices?.[0]?.shipmentMethods ?? [];
      const cheapest = shipping.reduce(
        (best: any, m: any) => (best && Number(best.price) < Number(m.price) ? best : m),
        null,
      );
      const subtotal = productPrice;
      const shippingPrice = cheapest ? Number(cheapest.price) : 0;
      const totalCents = Math.round((subtotal + shippingPrice) * 100);

      return {
        productUid: sku.productUid,
        currency: "EUR",
        subtotal,
        shippingPrice,
        shippingMethod: cheapest?.shipmentMethodName ?? "Standard",
        shippingMethodUid: cheapest?.shipmentMethodUid ?? null,
        totalCents,
        raw: quote,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Quote failed";
      console.error("quoteOrder error:", msg);
      throw new Error(msg);
    }
  });
