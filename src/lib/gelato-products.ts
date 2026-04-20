/**
 * Gelato product UID catalog.
 *
 * Maps our (kind, size) selections to Gelato's `productUid` strings used in
 * /v4/orders:quote and /v4/orders calls. Find more UIDs in:
 *   https://dashboard.gelato.com/catalog (or API: GET /v3/catalogs/{catalog}/products)
 *
 * Currency for quoted prices: EUR.
 */
export type StickerSize = "2in" | "3in" | "4in" | "5in";
export type LabelSize = "small" | "large";

export type GelatoSku = {
  productUid: string;
  label: string;
  /** human-readable dimensions for UI */
  dimensions: string;
};

/**
 * Die-cut stickers (kiss-cut vinyl). UIDs follow Gelato's stickers catalog.
 * NOTE: verify these UIDs in your Gelato dashboard before going live —
 * Gelato occasionally renames product UIDs.
 */
export const STICKER_SKUS: Record<StickerSize, GelatoSku> = {
  "2in": {
    productUid: "stickers_pf_2x2-inch_pt_kiss-cut-vinyl_cl_4-0_ver",
    label: '2" × 2"',
    dimensions: "5.1 × 5.1 cm",
  },
  "3in": {
    productUid: "stickers_pf_3x3-inch_pt_kiss-cut-vinyl_cl_4-0_ver",
    label: '3" × 3"',
    dimensions: "7.6 × 7.6 cm",
  },
  "4in": {
    productUid: "stickers_pf_4x4-inch_pt_kiss-cut-vinyl_cl_4-0_ver",
    label: '4" × 4"',
    dimensions: "10.2 × 10.2 cm",
  },
  "5in": {
    productUid: "stickers_pf_5x5-inch_pt_kiss-cut-vinyl_cl_4-0_ver",
    label: '5" × 5"',
    dimensions: "12.7 × 12.7 cm",
  },
};

/**
 * Roll labels (suitable for bottles). Two sizes to start.
 */
export const LABEL_SKUS: Record<LabelSize, GelatoSku> = {
  small: {
    productUid: "labels_pf_3x4-inch_pt_white-bopp_cl_4-0_ver",
    label: '3" × 4" label',
    dimensions: "7.6 × 10.2 cm — fits 375ml / beer",
  },
  large: {
    productUid: "labels_pf_4x5-inch_pt_white-bopp_cl_4-0_ver",
    label: '4" × 5" label',
    dimensions: "10.2 × 12.7 cm — fits wine / spirits",
  },
};

/**
 * Pick the right Gelato SKU for a given studio configuration.
 * Bottles → roll labels; everything else → die-cut stickers.
 */
export function selectGelatoProduct(opts: {
  container: string | null;
  shape: string;
  size: StickerSize | LabelSize;
}): GelatoSku | null {
  const isBottle = ["wine", "champagne", "beer", "spirits", "growler"].includes(
    opts.container ?? "",
  );
  if (isBottle) {
    if (opts.size === "small" || opts.size === "large") {
      return LABEL_SKUS[opts.size];
    }
    // default mapping when sticker sizes are picked for a bottle
    return LABEL_SKUS.large;
  }
  if (opts.size in STICKER_SKUS) {
    return STICKER_SKUS[opts.size as StickerSize];
  }
  return STICKER_SKUS["3in"];
}

/**
 * Available size options based on container type.
 */
export function getSizeOptionsFor(container: string | null): {
  id: StickerSize | LabelSize;
  label: string;
  dimensions: string;
}[] {
  const isBottle = ["wine", "champagne", "beer", "spirits", "growler"].includes(
    container ?? "",
  );
  if (isBottle) {
    return Object.entries(LABEL_SKUS).map(([id, sku]) => ({
      id: id as LabelSize,
      label: sku.label,
      dimensions: sku.dimensions,
    }));
  }
  return Object.entries(STICKER_SKUS).map(([id, sku]) => ({
    id: id as StickerSize,
    label: sku.label,
    dimensions: sku.dimensions,
  }));
}
