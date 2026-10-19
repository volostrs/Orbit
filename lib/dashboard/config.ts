// Dashboard customization model. This is a per-browser preference (localStorage), not account data: Orbit has no
// auth yet, so nothing here syncs across browsers or devices. Notes, notebooks and AI chats are never touched.

export type WidgetSize = "compact" | "standard" | "wide";

export type ImageSource = { kind: "upload"; id: string } | { kind: "url"; url: string };
export interface ImageRef {
  source: ImageSource | null;
  fit: "cover" | "contain";
  // Focal point (0-100) used as object-position when the image is cropped (cover).
  fx: number;
  fy: number;
  caption: string;
}

export interface LinkItem {
  id: string;
  label: string;
  url: string;
}

interface Base {
  id: string;
  size: WidgetSize;
  hidden?: boolean;
}
export type Widget = Base &
  (
    | { type: "overview" }
    | { type: "recent"; count: number }
    | { type: "edited"; count: number }
    | { type: "favorites"; count: number }
    | { type: "pinned"; noteIds: string[] }
    | { type: "notebooks" }
    | { type: "welcome"; title: string; subtitle: string; image: ImageRef }
    | { type: "text"; title: string; body: string }
    | { type: "image"; image: ImageRef }
    | { type: "links"; title: string; links: LinkItem[] }
    | { type: "heading"; text: string }
  );
export type WidgetType = Widget["type"];

export interface Appearance {
  accent: string; // palette hex, "" = neutral
  background: string; // palette hex tint, "" = Orbit's own surface
  density: "comfortable" | "compact";
  cardStyle: "plain" | "tinted";
}

export interface DashboardConfig {
  version: 1;
  widgets: Widget[];
  appearance: Appearance;
}

export const STORAGE_KEY = "orbit.dashboard.v1";
export const COUNT_CHOICES = [3, 5, 8];

export const CATALOG: Record<WidgetType, { label: string; description: string; single: boolean; size: WidgetSize; group: "notes" | "personal" }> = {
  overview: { label: "Notes Overview", description: "Counts of your notes, notebooks and favorites.", single: true, size: "wide", group: "notes" },
  edited: { label: "Recently Edited", description: "Notes you changed most recently.", single: true, size: "standard", group: "notes" },
  recent: { label: "Recent Notes", description: "Notes you created most recently.", single: true, size: "standard", group: "notes" },
  favorites: { label: "Favorite Notes", description: "Notes you starred in the sidebar.", single: true, size: "standard", group: "notes" },
  pinned: { label: "Pinned Notes", description: "Pick the notes you always want within reach.", single: true, size: "standard", group: "notes" },
  notebooks: { label: "Notebook Shortcuts", description: "Jump into a notebook's latest note.", single: true, size: "wide", group: "notes" },
  welcome: { label: "Welcome Banner", description: "A title and message, with an optional cover image.", single: true, size: "wide", group: "personal" },
  text: { label: "Text Block", description: "A short reminder, goal or instructions.", single: false, size: "standard", group: "personal" },
  image: { label: "Image Card", description: "A picture with an optional caption.", single: false, size: "standard", group: "personal" },
  links: { label: "Quick Links", description: "Shortcuts to websites and resources.", single: false, size: "standard", group: "personal" },
  heading: { label: "Section Heading", description: "A label to group the widgets below it.", single: false, size: "wide", group: "personal" },
};

export const newId = () => crypto.randomUUID();
export const emptyImage = (): ImageRef => ({ source: null, fit: "cover", fx: 50, fy: 50, caption: "" });

export function makeWidget(type: WidgetType): Widget {
  const base = { id: newId(), size: CATALOG[type].size };
  switch (type) {
    case "recent":
    case "edited":
    case "favorites":
      return { ...base, type, count: 5 };
    case "pinned":
      return { ...base, type, noteIds: [] };
    case "welcome":
      return { ...base, type, title: "Welcome back", subtitle: "What's the plan for today?", image: emptyImage() };
    case "text":
      return { ...base, type, title: "Reminder", body: "" };
    case "image":
      return { ...base, type, image: emptyImage() };
    case "links":
      return { ...base, type, title: "Quick links", links: [] };
    case "heading":
      return { ...base, type, text: "New section" };
    default:
      return { ...base, type } as Widget;
  }
}

export function defaultConfig(): DashboardConfig {
  const w = (type: WidgetType, patch: Partial<Base> = {}) => ({ ...makeWidget(type), ...patch }) as Widget;
  return {
    version: 1,
    widgets: [w("overview"), w("edited"), w("favorites"), w("notebooks")],
    appearance: { accent: "", background: "", density: "comfortable", cardStyle: "plain" },
  };
}

const str = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);
const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const HEX = /^#[0-9a-fA-F]{6}$/;

// Only http(s) links/images are ever kept: no javascript:, data: or file: URLs.
export function safeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function normImage(v: unknown): ImageRef {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const s = (o.source && typeof o.source === "object" ? o.source : null) as Record<string, unknown> | null;
  let source: ImageSource | null = null;
  if (s?.kind === "upload" && typeof s.id === "string" && s.id) source = { kind: "upload", id: s.id };
  else if (s?.kind === "url" && typeof s.url === "string" && safeUrl(s.url)) source = { kind: "url", url: safeUrl(s.url)! };
  return { source, fit: o.fit === "contain" ? "contain" : "cover", fx: num(o.fx, 0, 100, 50), fy: num(o.fy, 0, 100, 50), caption: str(o.caption, 200) };
}

// Tolerant loader: anything missing or malformed falls back to a safe value; an unusable file gives the defaults.
export function normalizeConfig(raw: unknown): DashboardConfig {
  const base = defaultConfig();
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as DashboardConfig).widgets)) return base;
  const r = raw as { widgets: unknown[]; appearance?: Record<string, unknown> };
  const seen = new Set<string>();
  const ids = new Set<string>();
  const widgets: Widget[] = [];
  for (const item of r.widgets.slice(0, 60)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const type = o.type as WidgetType;
    if (!(type in CATALOG)) continue;
    if (CATALOG[type].single && seen.has(type)) continue;
    seen.add(type);
    const id = typeof o.id === "string" && o.id && !ids.has(o.id) ? o.id : newId();
    ids.add(id);
    const size: WidgetSize = o.size === "compact" || o.size === "wide" || o.size === "standard" ? o.size : CATALOG[type].size;
    const common = { id, size, ...(o.hidden === true ? { hidden: true } : {}) };
    const count = [3, 5, 8].includes(o.count as number) ? (o.count as number) : 5;
    switch (type) {
      case "recent":
      case "edited":
      case "favorites":
        widgets.push({ ...common, type, count });
        break;
      case "pinned":
        widgets.push({ ...common, type, noteIds: Array.isArray(o.noteIds) ? o.noteIds.filter((x): x is string => typeof x === "string").slice(0, 50) : [] });
        break;
      case "welcome":
        widgets.push({ ...common, type, title: str(o.title, 120), subtitle: str(o.subtitle, 300), image: normImage(o.image) });
        break;
      case "text":
        widgets.push({ ...common, type, title: str(o.title, 120), body: str(o.body, 4000) });
        break;
      case "image":
        widgets.push({ ...common, type, image: normImage(o.image) });
        break;
      case "links":
        widgets.push({
          ...common,
          type,
          title: str(o.title, 120),
          links: (Array.isArray(o.links) ? o.links : []).slice(0, 30).flatMap((l: unknown) => {
            const x = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
            const url = typeof x.url === "string" ? safeUrl(x.url) : null;
            return url ? [{ id: typeof x.id === "string" && x.id ? x.id : newId(), label: str(x.label, 80), url }] : [];
          }),
        });
        break;
      case "heading":
        widgets.push({ ...common, type, text: str(o.text, 120) });
        break;
      default:
        widgets.push({ ...common, type } as Widget);
    }
  }
  const a = r.appearance ?? {};
  return {
    version: 1,
    widgets,
    appearance: {
      accent: typeof a.accent === "string" && HEX.test(a.accent) ? a.accent : "",
      background: typeof a.background === "string" && HEX.test(a.background) ? a.background : "",
      density: a.density === "compact" ? "compact" : "comfortable",
      cardStyle: a.cardStyle === "tinted" ? "tinted" : "plain",
    },
  };
}

export function loadConfig(): DashboardConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeConfig(JSON.parse(raw)) : defaultConfig();
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config: DashboardConfig): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function uploadIds(config: DashboardConfig): Set<string> {
  const ids = new Set<string>();
  for (const w of config.widgets) {
    if ((w.type === "image" || w.type === "welcome") && w.image.source?.kind === "upload") ids.add(w.image.source.id);
  }
  return ids;
}
