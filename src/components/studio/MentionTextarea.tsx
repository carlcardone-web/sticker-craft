import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

export type MentionItem = {
  url: string;
  role: string;
};

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const ROLE_EMOJI: Record<string, string> = {
  subject: "🖼️",
  background: "🌄",
  "color-palette": "🎨",
  color: "🎨",
  palette: "🎨",
  style: "✨",
  pose: "🤸",
  mood: "🌙",
};

function emojiFor(role: string) {
  return ROLE_EMOJI[slugify(role)] ?? "📎";
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  references: MentionItem[];
  placeholder?: string;
  className?: string;
};

export function MentionTextarea({ value, onChange, references, placeholder, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  // Build options from references (dedupe by slug)
  const seen = new Set<string>();
  const options = references
    .map((r) => ({ ...r, slug: slugify(r.role || "reference") }))
    .filter((r) => r.slug && !seen.has(r.slug) && (seen.add(r.slug), true));

  const filtered = options.filter((o) => o.slug.includes(slugify(query)));

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    const caret = e.target.selectionStart ?? text.length;
    onChange(text);

    // Detect active @mention being typed
    const upToCaret = text.slice(0, caret);
    const at = upToCaret.lastIndexOf("@");
    if (at >= 0) {
      const between = upToCaret.slice(at + 1);
      // Valid if no whitespace between @ and caret
      if (!/\s/.test(between) && between.length <= 30) {
        setMentionStart(at);
        setQuery(between);
        setActiveIdx(0);
        setOpen(true);
        return;
      }
    }
    setOpen(false);
    setMentionStart(null);
  }

  function insertMention(slug: string) {
    if (mentionStart === null || !ref.current) return;
    const ta = ref.current;
    const caret = ta.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(caret);
    const insert = `@${slug} `;
    const next = before + insert + after;
    onChange(next);
    setOpen(false);
    setMentionStart(null);
    requestAnimationFrame(() => {
      const pos = before.length + insert.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % filtered.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(filtered[activeIdx].slug); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  // Sync overlay scroll with textarea
  useEffect(() => {
    const ta = ref.current;
    const ov = overlayRef.current;
    if (!ta || !ov) return;
    const sync = () => { ov.scrollTop = ta.scrollTop; ov.scrollLeft = ta.scrollLeft; };
    ta.addEventListener("scroll", sync);
    return () => ta.removeEventListener("scroll", sync);
  }, []);

  useLayoutEffect(() => {
    const ov = overlayRef.current;
    const ta = ref.current;
    if (ov && ta) { ov.scrollTop = ta.scrollTop; }
  }, [value]);

  // Render highlighted overlay
  const knownSlugs = new Set(options.map((o) => o.slug));
  const segments: { text: string; mention: boolean }[] = [];
  const re = /@([a-z0-9-]+)/gi;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    if (match.index > lastIdx) segments.push({ text: value.slice(lastIdx, match.index), mention: false });
    const slug = slugify(match[1]);
    segments.push({ text: match[0], mention: knownSlugs.has(slug) });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < value.length) segments.push({ text: value.slice(lastIdx), mention: false });

  return (
    <div className="relative">
      <div
        ref={overlayRef}
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-base text-transparent ${className ?? ""}`}
        style={{ font: "inherit" }}
      >
        {segments.map((s, i) =>
          s.mention ? (
            <span key={i} className="rounded bg-primary/15 text-primary/0 ring-1 ring-primary/30">{s.text}</span>
          ) : (
            <span key={i}>{s.text}</span>
          )
        )}
        {"\n"}
      </div>
      <Textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={`relative bg-transparent ${className ?? ""}`}
      />
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-border bg-popover p-1 shadow-lg max-h-64 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {options.length === 0
                ? "Upload a reference photo below to mention it."
                : `No reference matches “${query}”.`}
            </div>
          ) : (
            filtered.map((o, i) => (
              <button
                key={o.slug}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertMention(o.slug); }}
                onMouseEnter={() => setActiveIdx(i)}
                className={[
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  i === activeIdx ? "bg-accent" : "hover:bg-accent/60",
                ].join(" ")}
              >
                <img src={o.url} alt="" className="h-8 w-8 rounded-md object-cover border border-border" />
                <span className="text-base">{emojiFor(o.role)}</span>
                <span className="font-medium">@{o.slug}</span>
                <span className="ml-auto text-xs text-muted-foreground truncate">{o.role}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
