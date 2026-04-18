import type { CustomFont } from "./studio-store";

export type FontCategory = "Sans" | "Serif" | "Script" | "Display" | "Mono";

export type FontEntry = {
    family: string;
    category: FontCategory;
    /** Google Fonts param, e.g. "Playfair+Display". Omit for system fonts. */
    googleParam?: string;
    /** CSS fallback stack. */
    fallback: string;
};

export const FONT_LIBRARY: FontEntry[] = [
    // Sans
    { family: "Inter", category: "Sans", googleParam: "Inter:wght@400;600", fallback: "system-ui, sans-serif" },
    { family: "Poppins", category: "Sans", googleParam: "Poppins:wght@400;600", fallback: "sans-serif" },
    { family: "Montserrat", category: "Sans", googleParam: "Montserrat:wght@400;600", fallback: "sans-serif" },
    { family: "Raleway", category: "Sans", googleParam: "Raleway:wght@400;600", fallback: "sans-serif" },
    { family: "Work Sans", category: "Sans", googleParam: "Work+Sans:wght@400;600", fallback: "sans-serif" },
    { family: "Nunito", category: "Sans", googleParam: "Nunito:wght@400;700", fallback: "sans-serif" },
    { family: "Bebas Neue", category: "Sans", googleParam: "Bebas+Neue", fallback: "sans-serif" },
    { family: "Oswald", category: "Sans", googleParam: "Oswald:wght@400;600", fallback: "sans-serif" },
    // Serif
    { family: "Playfair Display", category: "Serif", googleParam: "Playfair+Display:wght@400;700", fallback: "serif" },
    { family: "Merriweather", category: "Serif", googleParam: "Merriweather:wght@400;700", fallback: "serif" },
    { family: "Lora", category: "Serif", googleParam: "Lora:wght@400;600", fallback: "serif" },
    { family: "Cormorant Garamond", category: "Serif", googleParam: "Cormorant+Garamond:wght@400;600", fallback: "serif" },
    { family: "EB Garamond", category: "Serif", googleParam: "EB+Garamond:wght@400;600", fallback: "serif" },
    { family: "DM Serif Display", category: "Serif", googleParam: "DM+Serif+Display", fallback: "serif" },
    { family: "Crimson Text", category: "Serif", googleParam: "Crimson+Text:wght@400;600", fallback: "serif" },
    // Script
    { family: "Dancing Script", category: "Script", googleParam: "Dancing+Script:wght@400;700", fallback: "cursive" },
    { family: "Great Vibes", category: "Script", googleParam: "Great+Vibes", fallback: "cursive" },
    { family: "Pacifico", category: "Script", googleParam: "Pacifico", fallback: "cursive" },
    { family: "Caveat", category: "Script", googleParam: "Caveat:wght@400;700", fallback: "cursive" },
    { family: "Sacramento", category: "Script", googleParam: "Sacramento", fallback: "cursive" },
    { family: "Allura", category: "Script", googleParam: "Allura", fallback: "cursive" },
    { family: "Parisienne", category: "Script", googleParam: "Parisienne", fallback: "cursive" },
    // Display
    { family: "Abril Fatface", category: "Display", googleParam: "Abril+Fatface", fallback: "serif" },
    { family: "Lobster", category: "Display", googleParam: "Lobster", fallback: "cursive" },
    { family: "Bungee", category: "Display", googleParam: "Bungee", fallback: "sans-serif" },
    { family: "Anton", category: "Display", googleParam: "Anton", fallback: "sans-serif" },
    { family: "Righteous", category: "Display", googleParam: "Righteous", fallback: "sans-serif" },
    { family: "Fredoka", category: "Display", googleParam: "Fredoka:wght@400;600", fallback: "sans-serif" },
    { family: "Permanent Marker", category: "Display", googleParam: "Permanent+Marker", fallback: "cursive" },
    // Mono
    { family: "JetBrains Mono", category: "Mono", googleParam: "JetBrains+Mono:wght@400;600", fallback: "monospace" },
    { family: "Courier Prime", category: "Mono", googleParam: "Courier+Prime:wght@400;700", fallback: "monospace" },
];

const loadedGoogleFonts = new Set<string>();

export function ensureGoogleFont(family: string): void {
    if (typeof document === "undefined") return;
    const entry = FONT_LIBRARY.find((f) => f.family === family);
    if (!entry || !entry.googleParam) return;
    if (loadedGoogleFonts.has(family)) return;
    loadedGoogleFonts.add(family);
    const id = `gf-${entry.googleParam.replace(/[^a-z0-9]/gi, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${entry.googleParam}&display=swap`;
    document.head.appendChild(link);
}

export function ensureAllGoogleFonts(families: string[]): void {
    families.forEach(ensureGoogleFont);
}

export function injectCustomFonts(customFonts: CustomFont[]): void {
    if (typeof document === "undefined") return;
    let style = document.getElementById("studio-custom-fonts") as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement("style");
        style.id = "studio-custom-fonts";
        document.head.appendChild(style);
    }
    style.textContent = customFonts
        .map(
            (f) =>
                `@font-face { font-family: 'user-${f.id}'; src: url(${f.dataUrl}) format('${f.format}'); font-display: swap; }`,
        )
        .join("\n");
}

/**
 * Resolve a TextLayer.font value (a family name like "Inter" or a custom-font
 * sentinel like "user-<id>") to a CSS font-family string.
 */
export function getFontFamilyCSS(value: string, customFonts: CustomFont[]): string {
    if (value.startsWith("user-")) {
        const id = value.slice("user-".length);
        const cf = customFonts.find((f) => f.id === id);
        if (cf) return `'user-${cf.id}', system-ui, sans-serif`;
    }
    const entry = FONT_LIBRARY.find((f) => f.family === value);
    if (entry) return `'${entry.family}', ${entry.fallback}`;
    return `'${value}', system-ui, sans-serif`;
}

export function ensureFontLoaded(value: string): void {
    if (value.startsWith("user-")) return; // custom fonts injected separately
    ensureGoogleFont(value);
}

export function detectFontFormat(filename: string): string | null {
    const ext = filename.toLowerCase().split(".").pop();
    switch (ext) {
        case "ttf": return "truetype";
        case "otf": return "opentype";
        case "woff": return "woff";
        case "woff2": return "woff2";
        default: return null;
    }
}
