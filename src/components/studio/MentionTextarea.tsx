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
  maxLength?: number;
};

export function MentionTextarea({ value, onChange, references, placeholder, className, maxLength }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  const seen = new Set<string>();
  const options = references
    .map((reference) => ({ ...reference, slug: slugify(reference.role || "reference") }))
    .filter((reference) => reference.slug && !seen.has(reference.slug) && (seen.add(reference.slug), true));

  const filtered = options.filter((option) => option.slug.includes(slugify(query)));

  function clamp(text: string) {
    return typeof maxLength === "number" ? text.slice(0, maxLength) : text;
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = clamp(event.target.value);
    const caret = Math.min(event.target.selectionStart ?? text.length, text.length);
    onChange(text);

    const upToCaret = text.slice(0, caret);
    const at = upToCaret.lastIndexOf("@");
    if (at >= 0) {
      const between = upToCaret.slice(at + 1);
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
    const next = clamp(before + insert + after);
    onChange(next);
    setOpen(false);
    setMentionStart(null);
    requestAnimationFrame(() => {
      const pos = Math.min(before.length + insert.length, next.length);
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || filtered.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIdx((index) => (index + 1) % filtered.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIdx((index) => (index - 1 + filtered.length) % filtered.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insertMention(filtered[activeIdx].slug);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  useEffect(() => {
    const ta = ref.current;
    const overlay = overlayRef.current;
    if (!ta || !overlay) return;
    const sync = () => {
      overlay.scrollTop = ta.scrollTop;
      overlay.scrollLeft = ta.scrollLeft;
    };
    ta.addEventListener("scroll", sync);
    return () => ta.removeEventListener("scroll", sync);
  }, []);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const ta = ref.current;
    if (overlay && ta) {
      overlay.scrollTop = ta.scrollTop;
    }
  }, [value]);

  const knownSlugs = new Set(options.map((option) => option.slug));
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
        {segments.map((segment, index) =>
          segment.mention ? (
            <span key={index} className="rounded bg-primary/15 text-primary/0 ring-1 ring-primary/30">
              {segment.text}
            </span>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
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
        maxLength={maxLength}
        className={`relative bg-transparent ${className ?? ""}`}
      />
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {options.length === 0 ? "Upload a reference photo below to mention it." : `No reference matches “${query}”.`}
            </div>
          ) : (
            filtered.map((option, index) => (
              <button
                key={option.slug}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertMention(option.slug);
                }}
                onMouseEnter={() => setActiveIdx(index)}
                className={[
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  index === activeIdx ? "bg-accent" : "hover:bg-accent/60",
                ].join(" ")}
              >
                <img src={option.url} alt="" className="h-8 w-8 rounded-md border border-border object-cover" />
                <span className="text-base">{emojiFor(option.role)}</span>
                <span className="font-medium">@{option.slug}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">{option.role}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
