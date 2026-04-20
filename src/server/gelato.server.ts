/**
 * Server-only Gelato API helpers. NEVER import from client code.
 */
const GELATO_BASE = "https://order.gelatoapis.com";

function getApiKey(): string {
  const key = process.env.GELATO_API_KEY;
  if (!key) throw new Error("GELATO_API_KEY is not configured");
  return key;
}

export type GelatoAddress = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postCode: string;
  country: string; // ISO-2 e.g. "DE", "US"
  state?: string;
  email: string;
  phone?: string;
  companyName?: string;
};

export type GelatoQuoteItem = {
  itemReferenceId: string;
  productUid: string;
  pageCount?: number;
  files: { type: "default"; url: string }[];
  quantity: number;
};

export async function gelatoQuote(opts: {
  recipient: GelatoAddress;
  items: GelatoQuoteItem[];
  currency?: string;
}) {
  const body = {
    orderReferenceId: `quote-${Date.now()}`,
    customerReferenceId: opts.recipient.email,
    currency: opts.currency ?? "EUR",
    recipient: opts.recipient,
    products: opts.items,
  };

  const res = await fetch(`${GELATO_BASE}/v4/orders:quote`, {
    method: "POST",
    headers: {
      "X-API-KEY": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Gelato quote failed:", res.status, data);
    throw new Error(data?.message || `Gelato quote failed (${res.status})`);
  }
  return data;
}

export async function gelatoCreateOrder(opts: {
  orderReferenceId: string;
  recipient: GelatoAddress;
  items: GelatoQuoteItem[];
  currency?: string;
  shippingMethodUid?: string;
}) {
  const body = {
    orderReferenceId: opts.orderReferenceId,
    customerReferenceId: opts.recipient.email,
    currency: opts.currency ?? "EUR",
    orderType: "order",
    recipient: opts.recipient,
    items: opts.items,
    ...(opts.shippingMethodUid && {
      shipmentMethodUid: opts.shippingMethodUid,
    }),
  };

  const res = await fetch(`${GELATO_BASE}/v4/orders`, {
    method: "POST",
    headers: {
      "X-API-KEY": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Gelato create order failed:", res.status, data);
    throw new Error(data?.message || `Gelato order failed (${res.status})`);
  }
  return data;
}
