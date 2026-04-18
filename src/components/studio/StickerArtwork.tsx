import { getLabelDimensions, type StickerShape, type TextLayer, type ImageTransform } from "@/lib/studio-store";

type Props = {
    imageUrl: string | null;
    shape: StickerShape;
    textLayers: TextLayer[];
    whiteBorder: boolean;
    container?: string | null;
    volume?: string | null;
    size?: number; // longest-edge px budget
    showDimensions?: boolean;
    showScaleHint?: boolean;
    imageTransform?: ImageTransform;
    className?: string;
};

function shapeRadius(shape: StickerShape): string {
    switch (shape) {
      case "rectangle": return "12px";
      case "oval":      return "50%";
      case "circle":    return "50%";
      case "diecut":    return "28px";
      case "square":    return "8px";
      case "rounded":   return "24px";
      default:          return "12px";
    }
}

function shapeAspectFallback(shape: StickerShape): number {
    switch (shape) {
      case "circle":
      case "square":
      case "rounded":
        return 1;
      case "oval":
      case "rectangle":
      case "diecut":
        return 3 / 4;
      default:
        return 3 / 4;
    }
}

// Shapes whose silhouette is independent of the underlying label dimensions —
// they should always render as a perfect square/circle no matter the bottle size.
function isFixedSquareShape(shape: StickerShape): boolean {
    return shape === "circle" || shape === "square" || shape === "rounded";
}

export function StickerArtwork({
    imageUrl,
    shape,
    textLayers,
    whiteBorder,
    container,
    volume,
    size = 280,
    showDimensions = false,
    showScaleHint = false,
    imageTransform,
    className = "",
}: Props) {
    const dims = getLabelDimensions(container, volume);
    const t = imageTransform ?? { scale: 1, offsetX: 0, offsetY: 0 };

    // Real-world dimensions (cm) used both for shape ratio AND on-screen scaling.
    // For square/circle/rounded we collapse to a square using the smaller edge,
    // so e.g. a 6cm circle renders smaller than a 10x12 rectangle on the same canvas.
    let realW: number;
    let realH: number;
    if (dims) {
      if (isFixedSquareShape(shape)) {
        const edge = Math.min(dims.w, dims.h);
        realW = edge;
        realH = edge;
      } else {
        realW = dims.w;
        realH = dims.h;
      }
    } else {
      const ratio = shapeAspectFallback(shape);
      realW = ratio >= 1 ? 1 : ratio;
      realH = ratio >= 1 ? 1 / ratio : 1;
    }

    // Use the bottle's natural max edge as a shared scale reference, so all
    // shapes for the same bottle render against the same pixel budget.
    const bottleMaxEdge = dims ? Math.max(dims.w, dims.h) : Math.max(realW, realH);
    const width = Math.round(size * (realW / bottleMaxEdge));
    const height = Math.round(size * (realH / bottleMaxEdge));

    const radius = shapeRadius(shape);
    const padding = whiteBorder ? Math.round(Math.min(width, height) * 0.04) : 0;

    const dimsCaption = dims
      ? isFixedSquareShape(shape)
        ? `${Math.min(dims.w, dims.h)} × ${Math.min(dims.w, dims.h)} cm`
        : `${dims.w} × ${dims.h} cm`
      : null;

    return (
      <div className={"flex flex-col items-center " + className}>
        <div className="relative" style={{ width, height }}>
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              borderRadius: radius,
              padding,
              background: whiteBorder ? "#ffffff" : "transparent",
              boxShadow:
                "0 18px 40px -16px rgba(20,30,28,0.35), 0 2px 6px rgba(20,30,28,0.08)",
            }}
          >
            <div
              className="relative h-full w-full overflow-hidden bg-muted"
              style={{ borderRadius: radius }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Sticker artwork"
                  className="h-full w-full object-cover"
                  draggable={false}
                  style={{
                    transform: `translate(${t.offsetX}%, ${t.offsetY}%) scale(${t.scale})`,
                    transformOrigin: "center",
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground p-4 text-center">
                  Your label will appear here
                </div>
              )}
              {textLayers.map((l) => (
                <span
                  key={l.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 select-none px-2 text-center leading-tight"
                  style={{
                    left: `${l.x}%`,
                    top: `${l.y}%`,
                    fontFamily: l.font,
                    color: l.color,
                    fontSize: l.size,
                    textShadow: "0 1px 2px rgba(255,255,255,0.4)",
                    maxWidth: "90%",
                  }}
                >
                  {l.text}
                </span>
              ))}
            </div>
          </div>
        </div>
        {showDimensions && dimsCaption && (
          <p className="mt-3 text-xs text-muted-foreground tabular-nums">{dimsCaption}</p>
        )}
        {showScaleHint && dims && (
          <p className="mt-1 text-[10px] text-muted-foreground/70 italic">Shown to scale relative to your bottle choice.</p>
        )}
      </div>
    );
}
