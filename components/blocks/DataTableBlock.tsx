"use client";

import { useEffect, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Settings2, Trash2, X } from "lucide-react";
import { BlockShell, frameStyle, PALETTE, StyleMenu, tint } from "./blockStyle";
import { FloatingPopover } from "../ui/floating-popover";

export type ColumnType = "text" | "number" | "checkbox" | "date" | "select";
type CellValue = string | number | boolean | null;

interface Column {
  id: string;
  name: string;
  type: ColumnType;
  options?: string[];
  // Select columns only: option name -> palette hex. A missing entry means the neutral default.
  optionColors?: Record<string, string>;
}

interface Row {
  id: string;
  cells: Record<string, CellValue>;
}

interface TableData {
  columns: Column[];
  rows: Row[];
}

const COLUMN_TYPES: ColumnType[] = ["text", "number", "checkbox", "date", "select"];
const TYPE_LABELS: Record<ColumnType, string> = { text: "Text", number: "Number", checkbox: "Checkbox", date: "Date", select: "Select" };

const newId = () => crypto.randomUUID();

// Fixed ids keep the fallback stable across renders when a block has no saved data yet.
function defaultData(): TableData {
  return {
    columns: [
      { id: "col-name", name: "Name", type: "text" },
      { id: "col-status", name: "Status", type: "select", options: ["Todo", "In progress", "Done"] },
    ],
    rows: [{ id: "row-1", cells: {} }],
  };
}

export const DEFAULT_TABLE_DATA = () => JSON.stringify(defaultData());

// Older saves may lack ids, types, options or cell maps, and cells may hold values from another type. Fill in what
// is missing and read every value as its column's type. Nothing is rewritten until the user edits the table.
function parseData(raw: string): TableData {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.columns) && Array.isArray(parsed?.rows)) {
      const columns: Column[] = parsed.columns
        .filter((c: unknown) => c && typeof c === "object")
        .map((c: Partial<Column>, i: number) => {
          const type = COLUMN_TYPES.includes(c.type as ColumnType) ? (c.type as ColumnType) : "text";
          return {
            id: typeof c.id === "string" && c.id ? c.id : `col-legacy-${i}`,
            name: typeof c.name === "string" ? c.name : `Column ${i + 1}`,
            type,
            ...(type === "select" ? selectConfig(c) : {}),
          };
        });
      return {
        columns,
        rows: parsed.rows
          .filter((r: unknown) => r && typeof r === "object")
          .map((r: Partial<Row>, i: number) => {
            const cells: Record<string, CellValue> = {};
            const src = r.cells && typeof r.cells === "object" ? r.cells : {};
            for (const col of columns) cells[col.id] = readCell(col.type, (src as Record<string, unknown>)[col.id]);
            return { id: typeof r.id === "string" && r.id ? r.id : `row-legacy-${i}`, cells };
          }),
      };
    }
  } catch {}
  return defaultData();
}

// Options plus their colors; colors for unknown options or values outside the palette are ignored.
function selectConfig(c: Partial<Column>): Pick<Column, "options" | "optionColors"> {
  const options = Array.isArray(c.options) ? c.options.map(String).filter(Boolean) : [];
  const optionColors: Record<string, string> = {};
  if (c.optionColors && typeof c.optionColors === "object") {
    for (const o of options) {
      const hex = (c.optionColors as Record<string, unknown>)[o];
      if (typeof hex === "string" && PALETTE.some((p) => p.hex === hex)) optionColors[o] = hex;
    }
  }
  return { options, ...(Object.keys(optionColors).length ? { optionColors } : {}) };
}

function readCell(type: ColumnType, v: unknown): CellValue {
  if (v === undefined || v === null || v === "") return emptyValue(type);
  switch (type) {
    case "checkbox":
      return v === true || v === "true" || v === 1 || v === "1";
    case "number": {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    }
    case "date":
      // Keep an unrecognised legacy date string as-is (the date input shows it blank; the value is not lost).
      return typeof v === "string" ? (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : v) : null;
    default:
      return typeof v === "object" ? null : String(v);
  }
}

function emptyValue(type: ColumnType): CellValue {
  return type === "checkbox" ? false : null;
}

const isEmpty = (v: CellValue | undefined) => v === null || v === undefined || v === "";

// Sorting is by column type (numbers numerically, dates by calendar order, checkboxes unchecked first, text
// case-insensitively); empty cells always sort last, in either direction.
function compare(a: CellValue, b: CellValue, type: ColumnType) {
  if (type === "number") return Number(a) - Number(b);
  if (type === "checkbox") return Number(Boolean(a)) - Number(Boolean(b));
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });
}

type Filter = { colId: string; value: string };
const EMPTY_FILTER = "__empty__";

function matchesFilter(value: CellValue, col: Column, filter: string) {
  if (col.type === "checkbox") return Boolean(value) === (filter === "true");
  if (col.type === "select") return filter === EMPTY_FILTER ? isEmpty(value) : value === filter;
  return String(value ?? "").toLowerCase().includes(filter.toLowerCase());
}

// Overdue highlighting applies to Date columns named "Due Date" (case and surrounding spaces ignored). It
// compares local calendar dates as YYYY-MM-DD strings, so no timestamp or UTC conversion is involved.
const isDueDateColumn = (col: Column) => col.type === "date" && col.name.trim().toLowerCase() === "due date";

function localDateString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isRealDate(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

const isOverdue = (value: CellValue, today: string) => typeof value === "string" && isRealDate(value) && value < today;

// Today's local date, refreshed at local midnight and whenever the tab regains focus (covers sleep and clock changes).
function useToday() {
  const [today, setToday] = useState(() => localDateString());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => setToday(localDateString());
    const schedule = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, next.getTime() - now.getTime());
    };
    schedule();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return today;
}

const inputClass = "w-full bg-transparent px-2 py-1.5 text-sm text-neutral-200 outline-none focus:bg-neutral-800/60";
const pillBase = "inline-block max-w-full truncate rounded-full border px-2 py-0.5 text-xs leading-4 text-neutral-100";

function Pill({ name, hex }: { name: string; hex?: string }) {
  return (
    <span className={`${pillBase} ${hex ? "" : "border-neutral-700 bg-neutral-800"}`} style={hex ? { backgroundColor: tint(hex, "33"), borderColor: tint(hex, "99") } : undefined}>
      {name}
    </span>
  );
}

const smallField = "w-full rounded bg-neutral-800 px-1.5 py-1 text-neutral-200 outline-none";

function Cell({
  col,
  value,
  editable,
  overdue = false,
  onChange,
}: {
  col: Column;
  value: CellValue;
  editable: boolean;
  overdue?: boolean;
  onChange: (v: CellValue) => void;
}) {
  if (col.type === "checkbox") {
    return (
      <div className="px-2 py-1.5">
        <input
          type="checkbox"
          aria-label={`${col.name} checkbox`}
          disabled={!editable}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    );
  }
  if (col.type === "select") {
    const options = col.options ?? [];
    const current = String(value ?? "");
    return (
      // The native select stays the control (keyboard, touch, accessibility); the pill is drawn over its text.
      <div className="relative">
        <select
          className={`${inputClass} ${current ? "text-transparent" : ""}`}
          aria-label={`${col.name} value`}
          disabled={!editable}
          value={current}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="" className="bg-neutral-900 text-neutral-400">
            —
          </option>
          {/* Keep a value visible even if its option was later removed from the column. */}
          {(current && !options.includes(current) ? [current, ...options] : options).map((o) => {
            const hex = col.optionColors?.[o];
            return (
              <option
                key={o}
                value={o}
                className="bg-neutral-900 text-neutral-100"
                style={hex ? { backgroundColor: `color-mix(in srgb, ${hex} 35%, var(--color-neutral-900))` } : undefined}
              >
                {o}
              </option>
            );
          })}
        </select>
        {current && (
          <span className="pointer-events-none absolute inset-y-0 left-2 right-7 flex items-center" data-testid="select-pill">
            <Pill name={current} hex={col.optionColors?.[current]} />
          </span>
        )}
      </div>
    );
  }
  // Text-like inputs commit on blur/Enter so each keystroke isn't a full document save. Escape discards the edit.
  const shown = value === null || value === undefined ? "" : String(value);
  const commit = (raw: string) => {
    if (raw === shown) return;
    if (raw === "") return onChange(null);
    if (col.type === "number") {
      const n = Number(raw);
      return onChange(Number.isFinite(n) ? n : null);
    }
    onChange(raw);
  };
  return (
    <input
      className={overdue ? "w-full bg-red-500/20 px-2 py-1.5 text-sm text-red-700 outline-none dark:text-red-300" : inputClass}
      data-overdue={overdue ? "true" : undefined}
      title={overdue ? "Overdue" : undefined}
      aria-label={`${col.name} value`}
      type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
      readOnly={!editable}
      key={shown}
      defaultValue={shown}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.currentTarget.value = shown;
          e.currentTarget.blur();
        }
      }}
    />
  );
}

// Select options as an editable list. Renaming an option carries the cells that used it along with the new name.
function ColorSelect({ value, label, onChange }: { value: string; label: string; onChange: (hex: string) => void }) {
  return (
    <select
      aria-label={label}
      className="w-[4.5rem] shrink-0 rounded px-1 py-1 text-neutral-100 outline-none"
      style={{ backgroundColor: value ? tint(value, "40") : "var(--color-neutral-800)" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" className="bg-neutral-900">
        Default
      </option>
      {PALETTE.map((p) => (
        <option key={p.hex} value={p.hex} className="bg-neutral-900">
          {p.name}
        </option>
      ))}
    </select>
  );
}

function OptionsEditor({ options, colors, onRename, onColor, onAdd, onRemove }: { options: string[]; colors: Record<string, string>; onRename: (i: number, name: string) => void; onColor: (i: number, hex: string) => void; onAdd: (name: string, hex: string) => void; onRemove: (i: number) => void }) {
  const [draft, setDraft] = useState("");
  const [draftColor, setDraftColor] = useState("");
  const add = () => {
    const name = draft.trim();
    if (name) onAdd(name, draftColor);
    setDraft("");
  };
  return (
    <div className="space-y-1">
      <div className="text-neutral-400">Options</div>
      {options.length === 0 && <p className="text-neutral-500">No options yet.</p>}
      {options.map((o, i) => (
        <div key={`${i}:${o}`} className="flex items-center gap-1">
          <input
            className={smallField}
            aria-label={`Option ${i + 1}`}
            defaultValue={o}
            onBlur={(e) => onRename(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <ColorSelect value={colors[o] ?? ""} label={`Color for option ${o}`} onChange={(hex) => onColor(i, hex)} />
          <button type="button" aria-label={`Remove option ${o}`} className="text-neutral-500 hover:text-red-400" onClick={() => onRemove(i)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <input
          className={smallField}
          aria-label="New option"
          placeholder="Add option…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <ColorSelect value={draftColor} label="Color for new option" onChange={setDraftColor} />
        <button type="button" aria-label="Add option" className="text-neutral-400 hover:text-neutral-100" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function DataTable({
  data,
  editable,
  update,
  color,
  icon,
  iconColor,
  onStyleChange,
}: {
  data: TableData;
  editable: boolean;
  // Every edit is a function of the LATEST saved table (read at call time), never of the data this render saw,
  // so back-to-back edits (blur then click) can't overwrite each other.
  update: (fn: (d: TableData) => TableData) => void;
  color: string;
  icon: string;
  iconColor: string;
  onStyleChange: (patch: { color?: string; icon?: string; iconColor?: string }) => void;
}) {
  // Temporary view settings: never saved, never change the dataset.
  const [sort, setSort] = useState<{ colId: string; dir: "asc" | "desc" } | null>(null);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [openCol, setOpenCol] = useState<string | null>(null);
  const today = useToday();

  const { columns, rows } = data;
  const sortCol = columns.find((c) => c.id === sort?.colId);
  const filterCol = columns.find((c) => c.id === filter?.colId);
  const filtering = !!(filterCol && filter && filter.value !== "");

  let visible = rows;
  if (filterCol && filter && filtering) {
    visible = visible.filter((r) => matchesFilter(r.cells[filterCol.id] ?? null, filterCol, filter.value));
  }
  if (sortCol && sort) {
    const sign = sort.dir === "asc" ? 1 : -1;
    visible = [...visible].sort((a, b) => {
      const av = a.cells[sortCol.id] ?? null;
      const bv = b.cells[sortCol.id] ?? null;
      const ae = isEmpty(av) && sortCol.type !== "checkbox";
      const be = isEmpty(bv) && sortCol.type !== "checkbox";
      if (ae || be) return ae === be ? 0 : ae ? 1 : -1;
      return sign * compare(av, bv, sortCol.type);
    });
  }

  const updateColumn = (id: string, patch: Partial<Column>) =>
    update((d) => ({ ...d, columns: d.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  const changeType = (col: Column, type: ColumnType) => {
    if (type === col.type) return; // choosing the current type keeps every value
    // Values from the old type aren't meaningful for the new one, so only this column's cells are reset.
    update((d) => ({
      columns: d.columns.map((c) => {
        if (c.id !== col.id) return c;
        const { options: _old, optionColors: _oldColors, ...rest } = c;
        return { ...rest, type, ...(type === "select" ? { options: c.options?.length ? c.options : ["Option 1"] } : {}) };
      }),
      rows: d.rows.map((r) => ({ ...r, cells: { ...r.cells, [col.id]: emptyValue(type) } })),
    }));
    if (filter?.colId === col.id) setFilter(null);
    if (sort?.colId === col.id) setSort(null);
  };

  const deleteColumn = (col: Column) => {
    const hasData = rows.some((r) => !isEmpty(r.cells[col.id]) && r.cells[col.id] !== false);
    if (hasData && !confirm(`Delete the column “${col.name}” and its values? Other columns are not affected.`)) return;
    update((d) => ({
      columns: d.columns.filter((c) => c.id !== col.id),
      rows: d.rows.map((r) => {
        const { [col.id]: _removed, ...cells } = r.cells;
        return { ...r, cells };
      }),
    }));
    if (sort?.colId === col.id) setSort(null);
    if (filter?.colId === col.id) setFilter(null);
    setOpenCol(null);
  };

  const renameOption = (col: Column, i: number, raw: string) => {
    const name = raw.trim();
    const old = col.options?.[i];
    if (old === undefined || !name || name === old || col.options?.includes(name)) return;
    update((d) => ({
      columns: d.columns.map((c) => {
        if (c.id !== col.id) return c;
        const { [old]: hex, ...others } = c.optionColors ?? {};
        const optionColors = hex ? { ...others, [name]: hex } : others;
        return { ...c, options: (c.options ?? []).map((o, j) => (j === i ? name : o)), optionColors: Object.keys(optionColors).length ? optionColors : undefined };
      }),
      rows: d.rows.map((r) => (r.cells[col.id] === old ? { ...r, cells: { ...r.cells, [col.id]: name } } : r)),
    }));
    if (filter?.colId === col.id && filter.value === old) setFilter({ colId: col.id, value: name });
  };

  const setOptionColor = (col: Column, i: number, hex: string) => {
    const name = col.options?.[i];
    if (name === undefined) return;
    update((d) => ({
      ...d,
      columns: d.columns.map((c) => {
        if (c.id !== col.id) return c;
        const { [name]: _old, ...others } = c.optionColors ?? {};
        const optionColors = hex ? { ...others, [name]: hex } : others;
        return { ...c, optionColors: Object.keys(optionColors).length ? optionColors : undefined };
      }),
    }));
  };

  const addColumn = () =>
    update((d) => ({ ...d, columns: [...d.columns, { id: newId(), name: `Column ${d.columns.length + 1}`, type: "text" }] }));

  const addRow = () => update((d) => ({ ...d, rows: [...d.rows, { id: newId(), cells: {} }] }));

  const setCell = (rowId: string, colId: string, v: CellValue) =>
    update((d) => ({ ...d, rows: d.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: v } } : r)) }));

  const toggleSort = (colId: string) =>
    setSort((s) => (s?.colId !== colId ? { colId, dir: "asc" } : s.dir === "asc" ? { colId, dir: "desc" } : null));

  const toolbarSelect = "rounded bg-neutral-800 px-1.5 py-1 text-neutral-200";

  return (
    <div className="my-2 w-full rounded-lg border border-neutral-800 bg-neutral-900/40 text-neutral-200" style={frameStyle(color)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-2 py-1.5 text-xs text-neutral-400">
        <StyleMenu color={color} icon={icon} iconColor={iconColor} editable={editable} onChange={onStyleChange} />
        <label className="flex items-center gap-1.5">
          Filter
          <select
            className={toolbarSelect}
            aria-label="Filter column"
            value={filter?.colId ?? ""}
            onChange={(e) => setFilter(e.target.value ? { colId: e.target.value, value: "" } : null)}
          >
            <option value="">None</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {filterCol &&
          (filterCol.type === "checkbox" ? (
            <select className={toolbarSelect} aria-label="Filter value" value={filter?.value ?? ""} onChange={(e) => setFilter({ colId: filterCol.id, value: e.target.value })}>
              <option value="">Any</option>
              <option value="true">Checked</option>
              <option value="false">Unchecked</option>
            </select>
          ) : filterCol.type === "select" ? (
            <select className={toolbarSelect} aria-label="Filter value" value={filter?.value ?? ""} onChange={(e) => setFilter({ colId: filterCol.id, value: e.target.value })}>
              <option value="">Any</option>
              {(filterCol.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              <option value={EMPTY_FILTER}>(empty)</option>
            </select>
          ) : (
            <input
              className={`${toolbarSelect} outline-none`}
              aria-label="Filter value"
              placeholder="contains…"
              value={filter?.value ?? ""}
              onChange={(e) => setFilter({ colId: filterCol.id, value: e.target.value })}
            />
          ))}
        {filter && (
          <button type="button" onClick={() => setFilter(null)} aria-label="Clear filter" className="text-neutral-400 hover:text-neutral-100">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {(filtering || sort) && (
          <span className="ml-auto text-[11px] text-neutral-500" role="status">
            {filtering ? `Showing ${visible.length} of ${rows.length}` : "Sorted"} · view only
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: `${columns.length * 9 + 2}rem` }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.id} className="min-w-36 border-b border-r border-neutral-800 text-left font-medium">
                  <div className="flex items-center">
                    <input
                      className={`${inputClass} font-medium`}
                      aria-label={`Column name ${col.name}`}
                      readOnly={!editable}
                      key={col.name}
                      defaultValue={col.name}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && name !== col.name) updateColumn(col.id, { name });
                        else e.target.value = col.name;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") {
                          e.currentTarget.value = col.name;
                          e.currentTarget.blur();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="px-1 text-neutral-500 hover:text-neutral-200"
                      onClick={() => toggleSort(col.id)}
                      aria-label={`Sort by ${col.name}`}
                      title={sort?.colId === col.id ? (sort.dir === "asc" ? "Sorted ascending" : "Sorted descending") : "Sort"}
                    >
                      {sort?.colId === col.id ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-purple-400" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-purple-400" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {editable && (
                      <FloatingPopover
                        open={openCol === col.id}
                        onOpenChange={(o) => setOpenCol(o ? col.id : null)}
                        triggerLabel={`Configure ${col.name}`}
                        triggerClassName="px-1 text-neutral-500 hover:text-neutral-200"
                        trigger={<Settings2 className="h-3.5 w-3.5" />}
                        className="w-60 space-y-2.5 p-2.5"
                        align="end"
                      >
                        <label className="block text-neutral-400">
                          Type <span className="text-neutral-500">(changing it clears this column&apos;s values)</span>
                          <select
                            className={`mt-1 ${smallField}`}
                            aria-label="Column type"
                            value={col.type}
                            onChange={(e) => changeType(col, e.target.value as ColumnType)}
                          >
                            {COLUMN_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {TYPE_LABELS[t]}
                              </option>
                            ))}
                          </select>
                        </label>
                        {col.type === "select" && (
                          <OptionsEditor
                            options={col.options ?? []}
                            colors={col.optionColors ?? {}}
                            onRename={(i, name) => renameOption(col, i, name)}
                            onColor={(i, hex) => setOptionColor(col, i, hex)}
                            onAdd={(name, hex) =>
                              update((d) => ({
                                ...d,
                                columns: d.columns.map((c) =>
                                  c.id === col.id && !(c.options ?? []).includes(name)
                                    ? { ...c, options: [...(c.options ?? []), name], ...(hex ? { optionColors: { ...c.optionColors, [name]: hex } } : {}) }
                                    : c
                                ),
                              }))
                            }
                            onRemove={(i) =>
                              update((d) => ({
                                ...d,
                                columns: d.columns.map((c) => {
                                  if (c.id !== col.id) return c;
                                  const gone = (c.options ?? [])[i];
                                  const { [gone]: _hex, ...others } = c.optionColors ?? {};
                                  return { ...c, options: (c.options ?? []).filter((_, j) => j !== i), optionColors: Object.keys(others).length ? others : undefined };
                                }),
                              }))
                            }
                          />
                        )}
                        <button type="button" className="flex items-center gap-1 text-red-400 hover:text-red-300" onClick={() => deleteColumn(col)}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete column
                        </button>
                      </FloatingPopover>
                    )}
                  </div>
                </th>
              ))}
              {editable && (
                <th className="w-10 border-b border-neutral-800">
                  <button type="button" className="px-2 py-1.5 text-neutral-500 hover:text-neutral-200" onClick={addColumn} aria-label="Add column">
                    <Plus className="h-4 w-4" />
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="group">
                {columns.map((col) => (
                  <td key={col.id} className="border-b border-r border-neutral-800">
                    <Cell
                      col={col}
                      value={row.cells[col.id] ?? emptyValue(col.type)}
                      editable={editable}
                      overdue={isDueDateColumn(col) && isOverdue(row.cells[col.id] ?? null, today)}
                      onChange={(v) => setCell(row.id, col.id, v)} />
                  </td>
                ))}
                {editable && (
                  <td className="border-b border-neutral-800 text-center">
                    <button
                      type="button"
                      className="px-2 text-neutral-600 opacity-0 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100 pointer-coarse:opacity-100"
                      onClick={() => update((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== row.id) }))}
                      aria-label="Delete row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-2 py-3 text-center text-xs text-neutral-500">
                  {rows.length === 0 ? "No rows yet." : "No rows match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editable && (
        <button type="button" className="flex w-full items-center gap-1 px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-200" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" /> New row
        </button>
      )}
    </div>
  );
}

export const dataTableBlock = createReactBlockSpec(
  {
    type: "dataTable",
    propSchema: {
      // JSON-serialised TableData: { columns, rows }. Lives in the block, so it persists with notes.content.
      data: { default: "" },
      // Optional appearance; empty strings keep the original look.
      color: { default: "" },
      icon: { default: "" },
      iconColor: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const data = parseData(block.props.data);
      return (
        <BlockShell>
          <DataTable
            data={data}
            color={block.props.color}
            icon={block.props.icon}
            iconColor={block.props.iconColor}
            onStyleChange={(patch) => editor.updateBlock(block, { props: patch })}
            editable={editor.isEditable}
            update={(fn) => {
              // Start from the latest saved version of this block, not the one this render captured.
              const latest = editor.getBlock(block.id) ?? block;
              const next = fn(parseData((latest.props as { data: string }).data));
              editor.updateBlock(block, { props: { data: JSON.stringify(next) } });
              // If the cursor was on the table itself (e.g. it is the first block), the update leaves the
              // whole block node-selected and outlined. Park the cursor in a neighbouring block instead.
              try {
                if ("node" in editor.prosemirrorState.selection) {
                  const neighbour = editor.getNextBlock(block) ?? editor.getPrevBlock(block);
                  if (neighbour) editor.setTextCursorPosition(neighbour, "start");
                }
              } catch {}
            }}
          />
        </BlockShell>
      );
    },
  }
);
