import { getLabelDimensions, type StickerShape, type TextLayer } from "@/lib/studio-store";

type Props = {
    imageUrl: string | null;
    shape: StickerShape;
    textLayers: TextLayer[];
    whiteBorder: boolean;
    container?: string | null;
    volume?: string | null;
    size?: number; // longest-edge px
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
    // width / height
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

export function StickerArtwork({
    imageUrl,
    shape,
    textLayers,
    whiteBorder,
    container,
    volume,
    size = 280,
    className = "",
}: Props) {
    const dims = getLabelDimensions(container, volume);
    // Aspect ratio: real label W/H if available, else shape default
    const aspect = dims ? dims.w / dims.h : shapeAspectFallback(shape);

    // Fit longest edge to `size`
    const width = aspect >= 1 ? size : Math.round(size * aspect);
    const height = aspect >= 1 ? Math.round(size / aspect) : size;

    const radius = shapeRadius(shape);
    const padding = whiteBorder ? Math.round(Math.min(width, height) * 0.04) : 0;

    return (
      <div
        className={"relative " + className}
        style={{ width, height }}
      >
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
    );
}
