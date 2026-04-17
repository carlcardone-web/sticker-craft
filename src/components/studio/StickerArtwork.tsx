import type { StickerShape, TextLayer } from "@/lib/studio-store";

type Props = {
    imageUrl: string | null;
    shape: StickerShape;
    textLayers: TextLayer[];
    whiteBorder: boolean;
    size?: number; // px
    className?: string;
};

function shapeStyle(shape: StickerShape): React.CSSProperties {
    switch (shape) {
      case "rectangle":
              return { borderRadius: "12px", aspectRatio: "3 / 4" };
      case "oval":
              return { borderRadius: "50%",  aspectRatio: "3 / 4" };
      case "circle":
              return { borderRadius: "50%",  aspectRatio: "1 / 1" };
      case "diecut":
              return { borderRadius: "28px", aspectRatio: "3 / 4" };
    }
}

export function StickerArtwork({
    imageUrl,
    shape,
    textLayers,
    whiteBorder,
    size = 280,
    className = "",
}: Props) {
    const style = shapeStyle(shape);
    return (
          <div
                  className={"relative " + className}
                  style={{ width: size, ...style }}
                >
                <div
                          className="absolute inset-0 overflow-hidden"
                          style={{
                                      ...style,
                                      padding: whiteBorder ? Math.round(size * 0.04) : 0,
                                      background: whiteBorder ? "#ffffff" : "transparent",
                                      boxShadow:
                                                    "0 18px 40px -16px rgba(20,30,28,0.35), 0 2px 6px rgba(20,30,28,0.08)",
                          }}
                        >
                        <div
                                    className="relative h-full w-full overflow-hidden bg-muted"
                                    style={style}
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