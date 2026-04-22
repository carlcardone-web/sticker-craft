import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { persistReferenceImage } from "@/server/upload-artwork.server";

type Body = {
  imageUrl: string;
};

export const uploadReferenceImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Body) => {
    if (!input?.imageUrl || typeof input.imageUrl !== "string") {
      throw new Error("Reference image is required");
    }
    if (!input.imageUrl.startsWith("data:") && !input.imageUrl.startsWith("http")) {
      throw new Error("Unsupported reference image format");
    }
    return { imageUrl: input.imageUrl };
  })
  .handler(async ({ data, context }) => {
    const imageUrl = await persistReferenceImage({ imageUrl: data.imageUrl, userId: context.userId });
    return { imageUrl };
  });