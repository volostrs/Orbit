"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, EyeOff, LayoutGrid, Palette, Plus, RotateCcw, Settings2, SlidersHorizontal, Trash2, X } from "lucide-react";
import {
  type Appearance,
  CATALOG,
  type DashboardConfig,
  defaultConfig,
  loadConfig,
  makeWidget,
  saveConfig,
  uploadIds,
  type Widget,
  type WidgetSize,
  type WidgetType,
} from "@/lib/dashboard/config";
import { pruneImages } from "@/lib/dashboard/images";
import { PALETTE, tint } from "@/components/blocks/blockStyle";
import { useToast } from "@/components/ui/toast";
import { DashImage } from "./DashImage";
import { type DashData, hasSettings, WidgetBody, WidgetSettings, widgetTitle } from "./Widgets";

const SIZE_LABEL: Record<WidgetSize, string> = { compact: "Small", standard: "Medium", wide: "Wide" };
// Mobile: one column. Tablet: two. Desktop: six, so small/medium/wide span 2/3/6.
const SPAN: Record<WidgetSize, string> = { compact: "lg:col-span-2", standard: "lg:col-span-3", wide: "sm:col-span-2 lg:col-span-6" };
const ghost = "inline-flex items-center gap-1.5 rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-40";

// The Dashboard. Layout and look are a per-browser preference (localStorage; uploaded images in IndexedDB), edited
// on a draft copy that only becomes the saved layout when "Done" is pressed.
export function DashboardView({ data }: { data: DashData }) {
  const toast = useToast();
  const [saved, setSaved] = useState<DashboardConfig | null>(null);
  const [draft, setDraft] = useState<DashboardConfig | null>(null);
  const [panel, setPanel] = useState<"add" | "look" | null>(null);
  const [openSettings, setOpenSettings] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    // Read after mount so the server and first client render agree (preferences live in the browser).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(loadConfig());
  }, []);

  const editing = draft !== null;
  const config = draft ?? saved;
  const patch = (fn: (c: DashboardConfig) => DashboardConfig) => setDraft((d) => (d ? fn(d) : d));
  const note = (id: string) => {
    setFlash(id);
    requestAnimationFrame(() => refs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 1800);
  };

  const finish = (keep: DashboardConfig) => {
    pruneImages(uploadIds(keep)).catch(() => {});
  };
  const done = () => {
    if (!draft) return;
    if (!saveConfig(draft)) toast("Couldn't save the layout in this browser.");
    else toast("Dashboard saved");
    setSaved(draft);
    finish(draft);
    setDraft(null);
    setPanel(null);
    setOpenSettings(null);
  };
  const cancel = () => {
    if (saved) finish(saved);
    setDraft(null);
    setPanel(null);
    setOpenSettings(null);
  };
  const reset = () => {
    if (confirm("Reset the Dashboard to its default layout and look? Text, links and images you added will be removed when you press Done.")) {
      setDraft(defaultConfig());
      setOpenSettings(null);
    }
  };

  const move = (id: string, dir: -1 | 1) =>
    patch((c) => {
      const i = c.widgets.findIndex((w) => w.id === id);
      let j = i + dir;
      while (c.widgets[j]?.hidden) j += dir; // hidden widgets aren't on screen, so skip over them
      if (i < 0 || j < 0 || j >= c.widgets.length) return c;
      const widgets = [...c.widgets];
      [widgets[i], widgets[j]] = [widgets[j], widgets[i]];
      return { ...c, widgets };
    });
  const upd = (id: string, p: Partial<Widget>) => patch((c) => ({ ...c, widgets: c.widgets.map((w) => (w.id === id ? ({ ...w, ...p } as Widget) : w)) }));
  const add = (type: WidgetType) => {
    const existing = draft?.widgets.find((w) => w.type === type);
    if (existing && CATALOG[type].single) {
      // Single-instance widget that's currently hidden: bring it back (at the end, so it is easy to spot).
      patch((c) => ({ ...c, widgets: [...c.widgets.filter((w) => w.id !== existing.id), { ...existing, hidden: false }] }));
      note(existing.id);
      return;
    }
    const w = makeWidget(type);
    patch((c) => ({ ...c, widgets: [...c.widgets, w] }));
    if (hasSettings(w)) setOpenSettings(w.id);
    note(w.id);
  };
  const look = (p: Partial<Appearance>) => patch((c) => ({ ...c, appearance: { ...c.appearance, ...p } }));

  if (!config) {
    return <div className="mx-auto w-full max-w-5xl px-5 pb-16 pt-14 md:px-12 md:pt-16" aria-busy="true"><div className="h-8 w-40 animate-pulse rounded bg-neutral-800/60" /></div>;
  }

  const { appearance: a } = config;
  const visible = config.widgets.filter((w) => editing || !w.hidden);
  const compact = a.density === "compact";
  const cardBase = `${compact ? "rounded-lg p-3" : "rounded-xl p-4"} border`;
  const cardStyle = a.cardStyle === "tinted" && a.accent ? { backgroundColor: tint(a.accent, "14"), borderColor: tint(a.accent, "55") } : undefined;
  const plainCard = a.cardStyle === "tinted" && a.accent ? "" : "border-neutral-800 bg-neutral-900/50";
  const present = new Set(config.widgets.filter((w) => !w.hidden).map((w) => w.type));

  return (
    <div className="min-h-full" style={a.background ? { backgroundColor: tint(a.background, "1f") } : undefined} data-dashboard data-editing={editing}>
      <div className="mx-auto w-full max-w-5xl px-5 pb-20 pt-14 md:px-12 md:pt-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {a.accent && <span className="h-6 w-1 rounded-full" style={{ backgroundColor: a.accent }} aria-hidden />}
            <h2 className="text-2xl font-semibold text-neutral-100">Dashboard</h2>
          </div>
          {!editing && (
            <button type="button" onClick={() => setDraft(structuredClone(saved!))} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Customize Dashboard
            </button>
          )}
        </div>

        {editing && (
          <div role="region" aria-label="Customize Dashboard" className="sticky top-0 z-20 -mx-2 mt-4 space-y-3 rounded-xl border border-neutral-700 bg-neutral-950/95 p-3 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm text-neutral-300">Customizing. Changes are saved when you press <strong>Done</strong>.</p>
              <button type="button" className={ghost} aria-pressed={panel === "add"} onClick={() => setPanel(panel === "add" ? null : "add")}><Plus className="h-3.5 w-3.5" /> Add widget</button>
              <button type="button" className={ghost} aria-pressed={panel === "look"} onClick={() => setPanel(panel === "look" ? null : "look")}><Palette className="h-3.5 w-3.5" /> Appearance</button>
              <button type="button" className={ghost} onClick={reset}><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
              <button type="button" className={ghost} onClick={cancel}><X className="h-3.5 w-3.5" /> Cancel</button>
              <button type="button" onClick={done} className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-white">
                <Check className="h-3.5 w-3.5" /> Done
              </button>
            </div>

            {panel === "add" && (
              <div className="grid gap-4 sm:grid-cols-2" role="group" aria-label="Widget gallery">
                {(["notes", "personal"] as const).map((group) => (
                  <div key={group}>
                    <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">{group === "notes" ? "From your notes" : "Personal"}</h3>
                    <ul className="space-y-1">
                      {(Object.keys(CATALOG) as WidgetType[]).filter((t) => CATALOG[t].group === group).map((t) => {
                        const c = CATALOG[t];
                        const hidden = config.widgets.some((w) => w.type === t && w.hidden);
                        const on = c.single && present.has(t);
                        return (
                          <li key={t} className="flex items-center gap-2 rounded-lg bg-neutral-900/60 px-2.5 py-1.5">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-neutral-200">{c.label}</div>
                              <div className="text-xs text-neutral-500">{c.description}</div>
                            </div>
                            <button type="button" disabled={on} onClick={() => add(t)} aria-label={`${hidden ? "Restore" : "Add"} ${c.label}`} className={ghost}>
                              {on ? "Added" : hidden ? "Restore" : "Add"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {panel === "look" && (
              <div className="grid gap-3 text-xs text-neutral-400 sm:grid-cols-2" role="group" aria-label="Appearance">
                <Swatches label="Accent color" value={a.accent} onChange={(accent) => look({ accent })} />
                <Swatches label="Background tint" value={a.background} onChange={(background) => look({ background })} />
                <Choice label="Card spacing" value={a.density} options={[["comfortable", "Roomy"], ["compact", "Compact"]]} onChange={(density) => look({ density })} />
                <Choice label="Card style" value={a.cardStyle} options={[["plain", "Plain"], ["tinted", "Tinted with accent"]]} onChange={(cardStyle) => look({ cardStyle })} />
              </div>
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {visible.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-neutral-700 p-6 text-center text-sm text-neutral-500">
              Your Dashboard is empty. {editing ? "Use Add widget to put something here." : "Choose Customize Dashboard to add widgets."}
            </p>
          )}
          {visible.map((w, idx) => {
            const isHeading = w.type === "heading";
            const span = isHeading ? "sm:col-span-2 lg:col-span-6" : SPAN[w.size];
            const title = widgetTitle(w);
            const open = editing && openSettings === w.id;
            return (
              <section
                key={w.id}
                ref={(el) => {
                  if (el) refs.current.set(w.id, el);
                  else refs.current.delete(w.id);
                }}
                data-widget={w.type}
                data-widget-size={w.size}
                data-widget-hidden={w.hidden ? "true" : undefined}
                aria-label={isHeading ? undefined : title || CATALOG[w.type].label}
                className={`${span} min-w-0 ${isHeading ? "" : `${cardBase} ${plainCard}`} ${editing ? "outline-dashed outline-1 outline-offset-2 outline-neutral-600" : ""} ${flash === w.id ? "ring-2 ring-neutral-300" : ""} ${w.hidden ? "opacity-50" : ""} ${w.type === "welcome" ? "relative overflow-hidden" : ""}`}
                style={isHeading ? undefined : cardStyle}
              >
                {editing && (
                  <div className="-mt-1 mb-2 flex flex-wrap items-center gap-1 border-b border-neutral-800 pb-2 text-xs text-neutral-400">
                    <span className="mr-auto flex items-center gap-1.5">
                      <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">{idx + 1}</span>
                      {CATALOG[w.type].label}
                      {w.hidden && <span className="text-neutral-500">(hidden)</span>}
                    </span>
                    <button type="button" className={ghost} aria-label={`Move ${CATALOG[w.type].label} up`} disabled={idx === 0} onClick={() => { move(w.id, -1); note(w.id); }}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" className={ghost} aria-label={`Move ${CATALOG[w.type].label} down`} disabled={idx === visible.length - 1} onClick={() => { move(w.id, 1); note(w.id); }}><ArrowDown className="h-3.5 w-3.5" /></button>
                    {!isHeading && (
                      <span role="group" aria-label="Size" className="inline-flex overflow-hidden rounded-md border border-neutral-700">
                        {(["compact", "standard", "wide"] as const).map((s) => (
                          <button key={s} type="button" aria-pressed={w.size === s} aria-label={`${SIZE_LABEL[s]} size`} onClick={() => upd(w.id, { size: s })} className={`px-2 py-1.5 ${w.size === s ? "bg-neutral-700 text-neutral-100" : "hover:bg-neutral-800"}`}>
                            {SIZE_LABEL[s]}
                          </button>
                        ))}
                      </span>
                    )}
                    {hasSettings(w) && (
                      <button type="button" className={ghost} aria-expanded={open} aria-label={`Settings for ${CATALOG[w.type].label}`} onClick={() => setOpenSettings(open ? null : w.id)}><Settings2 className="h-3.5 w-3.5" /> Edit</button>
                    )}
                    {CATALOG[w.type].single ? (
                      <button type="button" className={ghost} aria-label={`Hide ${CATALOG[w.type].label}`} onClick={() => upd(w.id, { hidden: true })}><EyeOff className="h-3.5 w-3.5" /> Hide</button>
                    ) : (
                      <button type="button" className={`${ghost} text-red-400`} aria-label={`Remove ${CATALOG[w.type].label}`} onClick={() => patch((c) => ({ ...c, widgets: c.widgets.filter((x) => x.id !== w.id) }))}><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                    )}
                  </div>
                )}
                {open && (
                  <div className="mb-3 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                    <WidgetSettings w={w} data={data} update={(p) => upd(w.id, p)} />
                  </div>
                )}

                <div className={editing ? "pointer-events-none select-none" : undefined} aria-hidden={editing ? true : undefined}>
                  {w.type === "heading" ? (
                    <h3 className="mt-2 border-b border-neutral-800 pb-1 text-sm font-semibold uppercase tracking-wider text-neutral-400" style={a.accent ? { borderColor: tint(a.accent, "88") } : undefined}>
                      {w.text || "Untitled section"}
                    </h3>
                  ) : w.type === "welcome" ? (
                    <Banner w={w} accent={a.accent} />
                  ) : (
                    <>
                      {title && (
                        <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
                          {a.accent && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: a.accent }} aria-hidden />}
                          {title}
                        </h3>
                      )}
                      <WidgetBody w={w} data={data} />
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>
        {!editing && <p className="mt-8 flex items-center gap-1.5 text-[11px] text-neutral-600"><LayoutGrid className="h-3 w-3" /> Layout is saved in this browser.</p>}
      </div>
    </div>
  );
}

function Banner({ w, accent }: { w: Extract<Widget, { type: "welcome" }>; accent: string }) {
  const hasImg = !!w.image.source;
  return (
    <div className="relative -m-4 min-h-32 overflow-hidden rounded-xl" style={!hasImg && accent ? { backgroundColor: tint(accent, "26") } : undefined}>
      {hasImg && <DashImage image={w.image} className="absolute inset-0" />}
      {hasImg && <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/20" aria-hidden />}
      <div className="relative flex min-h-32 flex-col justify-center gap-1 px-5 py-5">
        <h3 className={`text-xl font-semibold ${hasImg ? "text-white" : "text-neutral-100"}`}>{w.title || "Welcome"}</h3>
        {w.subtitle && <p className={`text-sm ${hasImg ? "text-neutral-200" : "text-neutral-400"}`}>{w.subtitle}</p>}
      </div>
    </div>
  );
}

function Swatches({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  return (
    <div>
      <div className="mb-1">{label}</div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
        <button type="button" aria-label={`${label}: Default`} aria-pressed={value === ""} onClick={() => onChange("")} className={`h-6 rounded-full border px-2 text-[11px] ${value === "" ? "border-neutral-300 text-neutral-100" : "border-neutral-700"}`}>Default</button>
        {PALETTE.map((p) => (
          <button key={p.hex} type="button" title={p.name} aria-label={`${label}: ${p.name}`} aria-pressed={value === p.hex} onClick={() => onChange(p.hex)} className={`h-6 w-6 rounded-full border-2 ${value === p.hex ? "border-neutral-100" : "border-transparent"}`} style={{ backgroundColor: p.hex }} />
        ))}
      </div>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div>
      <div className="mb-1">{label}</div>
      <div className="inline-flex overflow-hidden rounded-md border border-neutral-700" role="group" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={`px-2.5 py-1.5 ${value === v ? "bg-neutral-700 text-neutral-100" : "hover:bg-neutral-800"}`}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
