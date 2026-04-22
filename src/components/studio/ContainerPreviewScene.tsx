import { StickerArtwork } from "@/components/studio/StickerArtwork";
import { getLabelDimensions, type ImageTransform, type StickerShape, type TextLayer } from "@/lib/studio-store";
import wineImg from "@/assets/mockups/wine-bottle.jpg";
import beerImg from "@/assets/mockups/beer-bottle.jpg";
import sodaImg from "@/assets/mockups/soda-can.jpg";
import waterImg from "@/assets/mockups/water-bottle.jpg";
import jarImg from "@/assets/mockups/mason-jar.jpg";

const CONTAINER_MOCKUPS = {
  wine: { id: "wine", label: "Wine bottle", image: wineImg, stickerSize: 134, top: "52%", perspective: "perspective(640px) rotateY(-6deg)" },
  champagne: { id: "champagne", label: "Champagne bottle", image: wineImg, stickerSize: 126, top: "51%", perspective: "perspective(640px) rotateY(-6deg)" },
  beer: { id: "beer", label: "Beer bottle", image: beerImg, stickerSize: 120, top: "60%", perspective: "perspective(640px) rotateY(-6deg)" },
  spirits: { id: "spirits", label: "Spirits bottle", image: waterImg, stickerSize: 128, top: "55%", perspective: "perspective(640px) rotateY(-5deg)" },
  can: { id: "can", label: "Can", image: sodaImg, stickerSize: 148, top: "55%", perspective: "perspective(640px) rotateY(-4deg)" },
  growler: { id: "growler", label: "Growler", image: jarImg, stickerSize: 152, top: "60%", perspective: "perspective(640px) rotateY(-4deg)" },
} as const;

const DEFAULT_MOCKUP = CONTAINER_MOCKUPS.wine;

type PreviewSize = "hero" | "compact";

type Props = {
  imageUrl: string | null;
  shape: StickerShape;
  textLayers: TextLayer[];
  whiteBorder: boolean;
  container: string | null;
  volume: string | null;
  imageTransform?: ImageTransform;
  size?: PreviewSize;
  className?: string;
};

export function getContainerMockup(container: string | null) {
  if (!container) return DEFAULT_MOCKUP;
  return CONTAINER_MOCKUPS[container as keyof typeof CONTAINER_MOCKUPS] ?? DEFAULT_MOCKUP;
}

export function getLabelCaption(container: string | null, volume: string | null, shape: StickerShape) {
  const dims = getLabelDimensions(container, volume);
  if (!dims) return null;

  const isFixedSquareShape = shape === "circle" || shape === "square" || shape === "rounded";
  const w = isFixedSquareShape ? Math.min(dims.w, dims.h) : dims.w;
  const h = isFixedSquareShape ? Math.min(dims.w, dims.h) : dims.h;
  const mockup = getContainerMockup(container);

  return `${w} × ${h} cm · shown to scale on ${mockup.label.toLowerCase()}`;
}

export function ContainerPreviewScene({
  imageUrl,
  shape,
  textLayers,
  whiteBorder,
  container,
  volume,
  imageTransform,
  size = "hero",
  className = "",
}: Props) {
  const mockup = getContainerMockup(container);
  const sceneAspect = size === "hero" ? "aspect-[4/5] sm:aspect-[5/4]" : "aspect-[4/5]";
  const stickerSize = size === "hero" ? mockup.stickerSize + 12 : mockup.stickerSize;

  return (
    <div
      className={[
        "relative flex w-full items-center justify-center overflow-hidden rounded-[12px] border border-border/60 bg-gradient-to-b from-muted/40 to-card",
        sceneAspect,
        className,
      ].join(" ")}
    >
      <img src={mockup.image} alt={mockup.label} className="absolute inset-0 h-full w-full object-contain" />
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ top: mockup.top, filter: "drop-shadow(0 8px 18px color-mix(in oklab, var(--foreground) 18%, transparent))" }}
      >
        <div style={{ transform: mockup.perspective }}>
          <StickerArtwork
            imageUrl={imageUrl}
            shape={shape}
            textLayers={textLayers}
            whiteBorder={whiteBorder}
            container={container}
            volume={volume}
            size={stickerSize}
            imageTransform={imageTransform}
          />
        </div>
      </div>
    </div>
  );
}
