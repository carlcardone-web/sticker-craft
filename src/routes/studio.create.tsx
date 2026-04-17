import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { STYLE_PRESETS, useStudio } from "@/lib/studio-store";
import { StickerArtwork } from "@/components/studio/StickerArtwork";
import { Sparkles, Upload, LayoutGrid, RefreshCw, ArrowRight, ShieldAlert } from "lucide-react";

const BLOCKLIST = [
  "disney", "marvel", "pokemon", "mickey", "elsa", "spider-man", "spiderman",
  "batman", "superman", "harry potter", "star wars", "nike logo", "coca-cola",
];

const TEMPLATES = [
  { occasion: "Wedding", title: "Eucalyptus monogram", color: "from-[oklch(0.86_0.04_150)] to-[oklch(0.92_0.02_120)]" },
  { occasion: "Wedding", title: "Gold botanical", color: "from-[oklch(0.92_0.05_85)] to-[oklch(0.86_0.04_70)]" },
  { occasion: "Birthday", title: "Confetti pop", color: "from-[oklch(0.88_0.08_30)] to-[oklch(0.9_0.07_55)]" },
  { occasion: "Birthday", title: "Pastel balloons", color: "from-[oklch(0.9_0.05_320)] to-[oklch(0.92_0.04_200)]" },
  { occasion: "Baby Shower", title: "Cloud nine", color: "from-[oklch(0.95_0.02_220)] to-[oklch(0.93_0.03_200)]" },
  { occasion: "Baby Shower", title: "Tiny moon", color: "from-[oklch(0.92_0.03_260)] to-[oklch(0.88_0.04_280)]" },
  { occasion: "Housewarming", title: "Welcome home", color: "from-[oklch(0.9_0.04_60)] to-[oklch(0.88_0.05_40)]" },
  { occasion: "Holiday", title: "Pine & cinnamon", color: "from-[oklch(0.85_0.06_150)] to-[oklch(0.8_0.07_30)]" },
  { occasion: "Holiday", title: "Snow garland", color: "from-[oklch(0.95_0.01_220)] to-[oklch(0.9_0.02_200)]" },
  { occasion: "Corporate", title: "Crisp monogram", color: "from-[oklch(0.92_0.01_250)] to-[oklch(0.88_0.02_240)]" },
];

export const Route = createFileRoute("/studio/create")({
  head: () => ({
    meta: [
      { title: "Create your sticker — Sticker Studio" },
      { name: "description", content: "Design custom stickers for bottles and cans with AI." },
    ],
  }),
  component: CreatePage,
});

function CreatePage() {
  const { prompt, stylePreset, imageUrl, setPrompt, setStylePreset, setImage, shape, textLayers, whiteBorder } = useStudio();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function moderate(text: string): string | null {
    const lower = text.toLowerCase();
    const hit = BLOCKLIST.find((w) => lower.includes(w));
    if (hit) return `“${hit}” isn't allowed. Try describing the mood, colors, or theme instead.`;
    return null;
  }

  async function handleGenerate() {
    setError(null);
    const m = moderate(prompt);
    if (m) { setError(m); return; }
    setLoading(true);
    // Placeholder: a soft sage gradient SVG until Replicate is wired
    await new Promise((r) => setTimeout(r, 900));
    const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><radialGradient id="g" cx="50%" cy="40%"><stop offset="0%" stop-color="%23c9d8c5"/><stop offset="100%" stop-color="%237ea38a"/></radialGradient></defs><rect width="400" height="400" fill="url(%23g)"/><text x="50%" y="55%" text-anchor="middle" font-family="Inter,sans-serif" font-size="22" fill="white" opacity="0.85">${(prompt || "Your design").slice(0, 28)}</text></svg>`;
    setImage(`data:image/svg+xml;utf8,${svg}`);
    setLoading(false);
  }

  function onUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-8 lg:gap-12">
      <section>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Create your sticker</h1>
        <p className="mt-2 text-muted-foreground">Three ways to start. Pick what feels right.</p>

        <Tabs defaultValue="describe" className="mt-8">
          <TabsList className="bg-muted/60 p-1 rounded-full h-auto">
            <TabsTrigger value="describe" className="rounded-full px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Sparkles className="h-4 w-4 mr-1.5" /> Describe it
            </TabsTrigger>
            <TabsTrigger value="upload" className="rounded-full px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Upload className="h-4 w-4 mr-1.5" /> Upload & style
            </TabsTrigger>
            <TabsTrigger value="templates" className="rounded-full px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <LayoutGrid className="h-4 w-4 mr-1.5" /> Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="describe" className="mt-6 space-y-5">
            <Textarea
              placeholder="A botanical wreath of eucalyptus and tiny wildflowers, soft watercolor, on cream"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-28 rounded-2xl border-border bg-card shadow-sm resize-none text-base"
            />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Style</p>
              <div className="flex flex-wrap gap-2">
                {STYLE_PRESETS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStylePreset(stylePreset === s.id ? null : s.id)}
                    className={[
                      "px-3.5 py-1.5 rounded-full text-sm transition-all",
                      stylePreset === s.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    ].join(" ")}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} size="lg" className="rounded-full px-6 shadow-glow bg-gradient-sage hover:opacity-95 text-primary-foreground">
                {loading ? (<><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Designing your sticker…</>) : "Generate"}
              </Button>
              {imageUrl && (
                <Button variant="ghost" onClick={handleGenerate} className="rounded-full">
                  <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="upload" className="mt-6 space-y-5">
            <label className="block border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
              <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="mt-2 font-medium">Drop a photo or click to upload</p>
              <p className="text-sm text-muted-foreground">PNG or JPG, up to 10MB</p>
            </label>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Style transfer</p>
              <div className="flex flex-wrap gap-2">
                {STYLE_PRESETS.map((s) => (
                  <button key={s.id} onClick={() => setStylePreset(s.id)} className={["px-3.5 py-1.5 rounded-full text-sm", stylePreset === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"].join(" ")}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.title}
                  onClick={() => {
                    const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="%23eef3ec"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Inter" font-size="20" fill="%237ea38a">${t.title}</text></svg>`;
                    setImage(`data:image/svg+xml;utf8,${svg}`);
                  }}
                  className="group text-left"
                >
                  <div className={`aspect-square rounded-2xl bg-gradient-to-br ${t.color} shadow-soft transition-transform group-hover:-translate-y-0.5 group-hover:shadow-soft-lg`} />
                  <p className="mt-2 text-sm font-medium truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.occasion}</p>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </section>

      <aside className="lg:sticky lg:top-28 self-start">
        <div className="rounded-3xl bg-card p-6 shadow-soft border border-border/60">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live preview</p>
          <div className="mt-4 flex items-center justify-center min-h-[280px]">
            <StickerArtwork imageUrl={imageUrl} shape={shape} textLayers={textLayers} whiteBorder={whiteBorder} size={240} />
          </div>
          <Button asChild disabled={!imageUrl} size="lg" className="w-full mt-6 rounded-full">
            <Link to="/studio/customize">Continue <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
      </aside>
    </div>
  );
}
