/**
 * Background worker route for sticker generation.
 *
 * Triggered by a pg_net.http_post() call from the generation_jobs INSERT
 * trigger. Decoupled from the user's original request so the slow Lovable
 * AI image call has its own request budget and never causes a 504 on the
 * user-facing endpoint.
 *
 * Security:
 *   - Public route (no auth) but every payload must carry a valid HMAC-SHA256
 *     signature in `x-generation-signature`, computed from the raw body using
 *     a shared secret stored in `private.app_settings` (DB-only).
 *   - Service role key (used via `supabaseAdmin`) is server-only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { persistArtwork } from "@/server/upload-artwork.server";

const IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";

type ReferenceImage = { url: string; role?: string; weight?: number };

type JobRow = {
  id: string;
  user_id: string;
  status: string;
  prompt: string;
  negative_prompt: string | null;
  seed: number | null;
  reference_images: ReferenceImage[] | null;
};

async function loadWorkerSecret(): Promise<string | null> {
  const fromEnv = process.env.GENERATION_WORKER_SECRET;
  if (fromEnv) return fromEnv;

  const { data, error } = await supabaseAdmin.rpc("get_generation_worker_secret");
  if (error) {
    console.error("loadWorkerSecret rpc failed", error);
    return null;
  }
  return (data as string | null) ?? null;
}

function verifySignature(rawBody: string, headerSig: string | null, secret: string): boolean {
  if (!headerSig) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(headerSig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function markFailed(jobId: string, message: string, detail: unknown) {
  await supabaseAdmin
    .from("generation_jobs")
    .update({
      status: "failed",
      error_message: message.slice(0, 500),
      error_detail: detail as never,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

async function processJob(jobId: string): Promise<void> {
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("generation_jobs")
    .update({
      status: "running",
      attempts: 1,
      started_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (claimErr) {
    console.error("claim job failed", jobId, claimErr);
    return;
  }
  if (!claimed) {
    console.info("job already claimed or missing", jobId);
    return;
  }

  const job = claimed as JobRow;
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    await markFailed(job.id, "AI is not configured. Please contact support.", { reason: "missing_api_key" });
    return;
  }

  const refs: ReferenceImage[] = Array.isArray(job.reference_images) ? job.reference_images : [];
  const userContent = [
    {
      type: "text",
      text: [job.prompt, job.negative_prompt ? `Negative prompt: ${job.negative_prompt}` : ""]
        .filter(Boolean)
        .join("\n\n"),
    },
    ...refs.map((ref) => ({ type: "image_url", image_url: { url: ref.url } })),
  ];

  console.info("processJob start", {
    jobId: job.id,
    userId: job.user_id,
    promptLength: job.prompt.length,
    refCount: refs.length,
  });

  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content: userContent }],
        modalities: ["image", "text"],
        seed: job.seed ?? undefined,
        negative_prompt: job.negative_prompt || undefined,
      }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("AI gateway fetch threw", job.id, message);
    await markFailed(job.id, "Generation failed. Please try again.", {
      stage: "fetch_threw",
      message,
      model: IMAGE_MODEL,
    });
    return;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let userMessage: string;
    if (res.status === 429) userMessage = "Too many requests. Give it a moment and try again.";
    else if (res.status === 402)
      userMessage = "AI credits are exhausted. Add credits in your workspace settings to keep generating.";
    else if (res.status === 504 || res.status === 524 || res.status === 408)
      userMessage = "Generation took too long. Try again with fewer or smaller reference images.";
    else userMessage = "Image generation failed. Please try again.";

    console.error("AI gateway error", res.status, text.slice(0, 500));
    await markFailed(job.id, userMessage, {
      stage: "gateway_response",
      status: res.status,
      body: text.slice(0, 2000),
      model: IMAGE_MODEL,
      promptLength: job.prompt.length,
      refCount: refs.length,
    });
    return;
  }

  let json: { choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }> };
  try {
    json = (await res.json()) as typeof json;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await markFailed(job.id, "Image generation returned an invalid response.", {
      stage: "json_parse",
      message,
    });
    return;
  }

  const generatedUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!generatedUrl) {
    await markFailed(job.id, "No image returned. Try a different prompt.", {
      stage: "no_image_in_response",
      raw: JSON.stringify(json).slice(0, 1000),
    });
    return;
  }

  let publicUrl: string;
  try {
    publicUrl = await persistArtwork({ imageUrl: generatedUrl, userId: job.user_id });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await markFailed(job.id, "Could not save the generated image. Please try again.", {
      stage: "persist_artwork",
      message,
    });
    return;
  }

  const { error: doneErr } = await supabaseAdmin
    .from("generation_jobs")
    .update({
      status: "done",
      image_url: publicUrl,
      finished_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (doneErr) {
    console.error("mark done failed", job.id, doneErr);
  } else {
    console.info("processJob done", { jobId: job.id });
  }
}

export const Route = createFileRoute("/api/public/run-generation-job")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const sig = request.headers.get("x-generation-signature");

        const secret = await loadWorkerSecret();
        if (!secret) {
          console.error("worker secret unavailable");
          return new Response("server misconfigured", { status: 500 });
        }
        if (!verifySignature(rawBody, sig, secret)) {
          return new Response("invalid signature", { status: 401 });
        }

        let payload: { jobId?: string };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("invalid body", { status: 400 });
        }
        const jobId = payload?.jobId;
        if (!jobId || typeof jobId !== "string") {
          return new Response("jobId required", { status: 400 });
        }

        try {
          await processJob(jobId);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error("processJob threw", jobId, message);
          await markFailed(jobId, "Generation failed unexpectedly.", { stage: "processJob_threw", message });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
