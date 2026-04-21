/**
 * Server-only helper: persist an AI-generated artwork (data URL or remote URL)
 * to Lovable Cloud Storage and return a stable public HTTPS URL.
 *
 * Gelato fetches artwork by URL — base64 data URLs from the AI gateway will
 * not work. Always run generated images through this before returning to
 * the client so the order checkout has a fulfillable URL.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "artworks";

function detectExtAndMime(url: string): { ext: string; mime: string } {
  const m = url.match(/^data:([^;,]+)(;base64)?,/i);
  if (m) {
    const mime = m[1];
    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    return { ext, mime };
  }
  // Default to png for non-data URLs
  return { ext: "png", mime: "image/png" };
}

async function urlToBytes(url: string): Promise<{ bytes: Uint8Array; mime: string; ext: string }> {
  const { ext, mime } = detectExtAndMime(url);

  if (url.startsWith("data:")) {
    const commaIdx = url.indexOf(",");
    const meta = url.slice(0, commaIdx);
    const payload = url.slice(commaIdx + 1);
    if (meta.includes(";base64")) {
      const bin = atob(payload);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { bytes, mime, ext };
    }
    const decoded = decodeURIComponent(payload);
    const bytes = new TextEncoder().encode(decoded);
    return { bytes, mime, ext };
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch artwork (${res.status})`);
  const ab = await res.arrayBuffer();
  const ct = res.headers.get("content-type") ?? mime;
  const detectedExt = ct.split("/")[1]?.split(";")[0]?.replace("jpeg", "jpg") ?? ext;
  return { bytes: new Uint8Array(ab), mime: ct, ext: detectedExt };
}

/**
 * Upload an artwork URL (data: or http(s):) to the public `artworks` bucket and
 * return its public URL. If the URL is already a same-bucket public URL it is
 * returned unchanged.
 */
export async function persistArtwork(opts: {
  imageUrl: string;
  userId: string;
}): Promise<string> {
  // Skip if already in our bucket
  if (opts.imageUrl.includes(`/storage/v1/object/public/${BUCKET}/`)) {
    return opts.imageUrl;
  }

  const { bytes, mime, ext } = await urlToBytes(opts.imageUrl);
  const fileName = `${opts.userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(fileName, bytes, {
      contentType: mime,
      cacheControl: "31536000, immutable",
      upsert: false,
    });
  if (error) {
    console.error("persistArtwork upload failed:", error);
    throw new Error("Could not save artwork. Please try again.");
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}
