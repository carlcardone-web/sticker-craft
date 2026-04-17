import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Wand2, Package } from "lucide-react";
import wineImg from "@/assets/mockups/wine-bottle.jpg";
import jarImg from "@/assets/mockups/mason-jar.jpg";
import sodaImg from "@/assets/mockups/soda-can.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sticker Studio — Custom stickers for bottles & cans" },
      { name: "description", content: "Design beautiful custom stickers for weddings, parties, and gifts. Free to design — only pay when you order." },
      { property: "og:title", content: "Sticker Studio — Custom stickers for bottles & cans" },
      { property: "og:description", content: "Design beautiful custom stickers in under a minute." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-full bg-gradient-sage shadow-glow" />
          <span className="font-semibold tracking-tight">Sticker Studio</span>
        </Link>
        <Button asChild variant="ghost" className="rounded-full">
          <Link to="/studio/bottle">Open studio</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-10 sm:pt-20 pb-16 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-soft text-primary-deep text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" /> AI-designed in seconds
          </span>
          <h1 className="mt-5 text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
            Custom stickers <br /> for every bottle.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-md">
            Design beautiful labels for weddings, parties, gifts, and brands.
            Free to create. Only pay when you order.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-7 h-12 shadow-glow bg-gradient-sage text-primary-foreground hover:opacity-95">
              <Link to="/studio/bottle">Start designing <ArrowRight className="h-4 w-4 ml-1.5" /></Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="rounded-full px-6 h-12">
              <Link to="/studio/bottle">See templates</Link>
            </Button>
          </div>
        </div>

        <div className="relative h-[440px] sm:h-[520px]">
          <div className="absolute right-0 top-4 w-56 sm:w-64 rounded-3xl overflow-hidden shadow-soft-lg bg-card animate-float">
            <img src={wineImg} alt="Wine bottle mockup" className="w-full h-full object-cover" loading="eager" width={768} height={1024} />
          </div>
          <div className="absolute left-0 top-24 w-44 sm:w-52 rounded-3xl overflow-hidden shadow-soft-lg bg-card animate-float" style={{ animationDelay: "1.5s" }}>
            <img src={jarImg} alt="Mason jar mockup" className="w-full h-full object-cover" loading="lazy" width={768} height={1024} />
          </div>
          <div className="absolute right-12 bottom-0 w-40 sm:w-44 rounded-3xl overflow-hidden shadow-soft-lg bg-card animate-float" style={{ animationDelay: "3s" }}>
            <img src={sodaImg} alt="Soda can mockup" className="w-full h-full object-cover" loading="lazy" width={768} height={1024} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 grid sm:grid-cols-3 gap-6">
        {[
          { Icon: Wand2, title: "Describe or upload", body: "Generate art with AI, or style your own photo." },
          { Icon: Sparkles, title: "Pick a shape, add text", body: "Six shapes, six fonts, full control." },
          { Icon: Package, title: "Download or order", body: "Print-ready files free. Pro vinyl shipped." },
        ].map(({ Icon, title, body }) => (
          <div key={title} className="rounded-3xl bg-card p-6 shadow-soft border border-border/60">
            <div className="h-10 w-10 rounded-2xl bg-primary-soft flex items-center justify-center text-primary-deep">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © Sticker Studio · Designed with care
      </footer>
    </div>
  );
}
