

## Goal
Wire **Gelato's Order API v4** into the checkout flow so a generated sticker/label can be ordered and fulfilled automatically (print + ship), with optional **Stripe** payment in front of it.

## What you need to do (account side, before any code)

1. **Create a Gelato account** at gelato.com → upgrade to **Gelato+** (required for API access on most plans).
2. **Get an API key** from the Gelato Dashboard → Developer → API keys.
3. **Pick the products you want to sell** in the Gelato product catalog and note their `productUid` strings (e.g. `cards_pf_a6_pt_300-gsm-uncoated_cl_4-4_hor` for stickers/labels). For wine/beer bottle labels you'll typically use their **Labels & Stickers** category.
4. **Decide who collects payment**: Gelato bills *you*; you charge the *customer* (via Stripe). I'll wire Stripe checkout in front so you don't ship before being paid.
5. (Optional) Add a **return address** in Gelato so misdeliveries come back to you.

You'll then give me **two secrets** when I ask: `GELATO_API_KEY` and (if using Stripe) we'll trigger Stripe enable separately.

## Architecture

```text
[Browser /studio/checkout]
    │ 1. POST /api/quote-order  (artwork URL + size + qty + address)
    ▼
[TanStack server route] ──► Gelato /v4/orders:quote ──► live price + shipping
    │ 2. POST /api/create-stripe-session  (with quoted total)
    ▼
[Stripe Checkout]  ─────► customer pays  ─────► Stripe webhook
    │ 3. POST /api/gelato-webhook-success
    ▼
[TanStack server route] ──► Gelato /v4/orders   (real order created)
    │
    ▼ store {orderId, status} in DB
[Gelato fulfillment] ──► webhook updates status (printed/shipped/tracking)
    │
    ▼
[/studio/orders/:id]  shows live status + tracking link
```

## Implementation steps

### 1. Backend (Lovable Cloud)
- New table `orders`: `id`, `user_id` (nullable for guests), `gelato_order_id`, `stripe_session_id`, `status`, `tracking_url`, `artwork_url`, `recipient` (jsonb), `items` (jsonb), `total_cents`, `currency`, `created_at`. RLS: users read their own; admin client writes.
- Server route `src/routes/api/quote.ts` (POST): calls `https://order.gelatoapis.com/v4/orders:quote` with shipping address + product UID + qty → returns price + shipping options.
- Server route `src/routes/api/order.ts` (POST): called from Stripe webhook *after payment confirmed* → calls `https://order.gelatoapis.com/v4/orders` with the artwork URL as `printFile` + recipient → stores `gelato_order_id`.
- Server route `src/routes/api/gelato-webhook.ts` (POST): receives Gelato order status updates (printing → printed → shipped) → updates `orders.status` and `tracking_url`. Verifies signature header.
- Server route `src/routes/api/stripe-webhook.ts`: on `checkout.session.completed`, triggers the order creation above.

### 2. Product catalog mapping
Hardcode a small map in `src/lib/gelato-products.ts`:
- Each `(shape, size, container)` combo → a Gelato `productUid`. Start with **die-cut stickers** + **roll labels** (used for bottles). I'll ship 4–6 SKUs initially; you can expand later.
- File ships with comments showing where to find more UIDs in Gelato's catalog.

### 3. Checkout UI (`src/routes/studio.checkout.tsx`)
- Replace the stub price calculator with a **Get live quote** button that calls `/api/quote` once the address is filled → shows real shipping options + total.
- Replace the fake "Place order" button with a **Pay now** button that creates a Stripe Checkout session and redirects.
- Add a success page `src/routes/studio.order.$id.tsx` that polls or subscribes to the `orders` row and shows status + tracking.

### 4. Artwork delivery to Gelato
Gelato fetches `printFile` by URL. Two options:
- **Easiest**: upload the generated sticker PNG to Lovable Cloud Storage (public bucket) and pass that URL.
- **Best quality**: server-side generate a 300 DPI print-ready PNG with bleed before upload (can be added later — start with what `s.imageUrl` already produces).

### 5. Payments
Recommend **Stripe** (you already need to charge per-order, no MOR needed for stickers in most regions). I'll trigger Stripe enable in a separate step once you confirm.

## What I need from you to start

1. Confirm you'll create a Gelato account and grab an API key (I'll prompt you to paste it as `GELATO_API_KEY` when we're ready).
2. Confirm **Stripe** for payment collection (vs Paddle, vs no payment gate).
3. Confirm initial product range — start with: **die-cut stickers (3 sizes)** + **roll labels for bottles (2 sizes)**, expand later?

## Out of scope (for v1)
- Bulk/wholesale pricing tiers
- Multi-currency display (we'll quote in USD or EUR, your pick)
- Returns/refund automation (handled manually via Gelato dashboard)
- 300 DPI bleed-aware print file generation (use the current PNG; upgrade later)
- Saved addresses / order history page beyond the single order status page

