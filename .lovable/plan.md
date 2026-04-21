

## Finish the checkout: 3 remaining items

### 1. Public artwork URLs (Storage upload)

The image generators return base64 data URLs from the Lovable AI gateway. Gelato cannot fetch those — it needs a public HTTPS URL. I'll persist every generated artwork to Lovable Cloud Storage and replace the data URL with the public URL before it leaves the server.

**What I'll add:**
- A new public storage bucket `artworks` (created via SQL migration with appropriate RLS — public read, authenticated insert under a `userId/` prefix).
- A small server helper `src/server/upload-artwork.ts` that takes a data URL or remote URL, decodes/fetches the bytes, uploads to `artworks/{userId}/{uuid}.png`, and returns the public URL.
- Wire the helper into the three generators (`generate-sticker.ts`, `edit-sticker-with-text.ts`, `generate-text-art.ts`) so every returned `imageUrl` is already a stable HTTPS URL. Existing callers don't change.
- Drop the data-URL fallback in `quoteOrder` — the HTTPS check stays as a safety net.

### 2. Gelato webhook secret

The receiver at `/api/gelato-webhook` already checks `GELATO_WEBHOOK_SECRET` against the `gelato-webhook-secret` header. Two things to do:

- I'll surface the exact webhook URL to register (your published URL + `/api/gelato-webhook`).
- Prompt you to add the `GELATO_WEBHOOK_SECRET` value via the secrets tool. Once set, signature checks activate automatically.

You'll need to:
1. Open Gelato dashboard → Developers → Webhooks.
2. Add endpoint: `https://<your-domain>/api/gelato-webhook`.
3. Subscribe to: `order_status_updated`, `order_item_status_updated`, `order_item_tracking_code_updated`.
4. Copy the secret Gelato gives you and paste it when prompted.

### 3. Confirmation emails (Lovable Emails — built-in)

I'll wire up Lovable's built-in transactional emails (no third-party account needed):

- Provision the email domain (you'll pick the sender domain in a one-click setup dialog and add the NS records to your DNS provider).
- Set up the email queue infrastructure (pgmq queues, `process-email-queue` cron, suppression + unsubscribe tables).
- Scaffold the transactional email server route + unsubscribe page.
- Create a branded `order-confirmation.tsx` React Email template (order ID, item, quantity, total, shipping address, link back to `/studio/order/{id}`).
- Create a `shipped-notification.tsx` template that fires when the Gelato webhook flips status to `shipped` (includes carrier + tracking link).
- Send order-confirmation from the Stripe webhook right after Gelato is triggered. Send shipped-notification from `/api/gelato-webhook` when status becomes `shipped`. Both use idempotency keys (`order-confirm-{orderId}`, `shipped-{orderId}`) so retries are safe.

### Technical notes

- Storage bucket policies: public SELECT, INSERT restricted to `auth.uid()::text = (storage.foldername(name))[1]`.
- Email sends go through the durable pgmq queue, so a transient Gelato failure or rate limit won't lose the email.
- The Stripe webhook currently swallows Gelato errors (logs only). I'll keep that, and email sends will be in their own try/catch so an email failure can't block fulfillment.
- No changes needed to the `orders` table schema — confirmation emails read from the existing `customer_email`, `recipient`, and `metadata` fields.

### What I need from you to start

1. Approve the storage bucket migration.
2. Approve the email domain setup (you'll be guided through the dialog).
3. Register the Gelato webhook URL and paste the `GELATO_WEBHOOK_SECRET` when prompted.

