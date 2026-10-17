"use client";

import { useEffect, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { ArrowDown, ArrowUp, Plus, Settings2, Trash2, X } from "lucide-react";
import { BlockShell, frameStyle, StyleMenu } from "./blockStyle";

export type ColumnType = "text" | "number" | "checkbox" | "date" | "select";
type CellValue = string | number | boolean | null;

interface Column {
  id: string;
  name: string;
  type: ColumnType;
  options?: string[];
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

function parseData(raw: string): TableData {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.columns) && Array.isArray(parsed?.rows)) {
      // Tolerate older saves: fill in missing ids, types and cell maps.
      return {
        columns: parsed.columns.map((c: Partial<Column>, i: number) => ({
          ...c,
          id: c.id ?? `col-legacy-${i}`,
          name: c.name ?? `Column ${i + 1}`,
          type: COLUMN_TYPES.includes(c.type as ColumnType) ? c.type : "text",
        })),
        rows: parsed.rows.map((r: Partial<Row>, i: number) => ({
          id: r.id ?? `row-legacy-${i}`,
          cells: r.cells ?? {},
        })),
      };
    }
  } catch {}
  return defaultData();
}

function emptyValue(type: ColumnType): CellValue {
  return type === "checkbox" ? false : null;
}

function compare(a: CellValue, b: CellValue, type: ColumnType) {
  const aEmpty = a === null || a === "" || a === undefined;
  const bEmpty = b === null || b === "" || b === undefined;
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
  if (type === "number") return Number(a) - Number(b);
  if (type === "checkbox") return Number(Boolean(a)) - Number(Boolean(b));
  return String(a).localeCompare(String(b));
}

function matchesFilter(value: CellValue, col: Column, filter: string) {
  if (col.type === "checkbox") return Boolean(value) === (filter === "true");
  return String(value ?? "").toLowerCase().includes(filter.toLowerCase());
}

const inputClass =
  "w-full bg-transparent px-2 py-1.5 text-sm text-neutral-200 outline-none focus:bg-neutral-800/60";

function Cell({
  col,
  value,
  editable,
  onChange,
}: {
  col: Column;
  value: CellValue;
  editable: boolean;
  onChange: (v: CellValue) => void;
}) {
  if (col.type === "checkbox") {
    return (
      <div className="px-2 py-1.5">
        <input
          type="checkbox"
          disabled={!editable}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    );
  }
  if (col.type === "select") {
    return (
      <select
        className={inputClass}
        disabled={!editable}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">—</option>
        {/* Keep a value visible even if its option was later removed from the column. */}
        {(value && !(col.options ?? []).includes(String(value)) ? [String(value), ...(col.options ?? [])] : col.options ?? []).map((o) => (
          <option key={o} value={o} className="bg-neutral-900">
            {o}
          </option>
        ))}
      </select>
    );
  }
  // Text-like inputs commit on blur/Enter so each keystroke isn't a full document save.
  const commit = (raw: string) => {
    if (raw === "") return onChange(null);
    onChange(col.type === "number" ? Number(raw) : raw);
  };
  return (
    <input
      className={inputClass}
      type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
      readOnly={!editable}
      key={String(value ?? "")}
      defaultValue={value === null || value === undefined ? "" : String(value)}
      onBlur={(e) => {
        if (e.target.value !== String(value ?? "")) commit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

function DataTable({
  data,
  editable,
  onChange,
  color,
  icon,
  iconColor,
  onStyleChange,
}: {
  data: TableData;
  editable: boolean;
  onChange: (d: TableData) => void;
  color: string;
  icon: string;
  iconColor: string;
  onStyleChange: (patch: { color?: string; icon?: string; iconColor?: string }) => void;
}) {
  const [sort, setSort] = useState<{ colId: string; dir: "asc" | "desc" } | null>(null);
  const [filter, setFilter] = useState<{ colId: string; value: string } | null>(null);
  const [openCol, setOpenCol] = useState<string | null>(null);

  // Close the column menu on an outside click or Escape. Capture phase, because BlockShell stops
  // mousedown from bubbling out of the block.
  useEffect(() => {
    if (!openCol) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`[data-col-menu="${openCol}"]`)) setOpenCol(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenCol(null);
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [openCol]);

  const { columns, rows } = data;
  const sortCol = columns.find((c) => c.id === sort?.colId);
  const filterCol = columns.find((c) => c.id === filter?.colId);

  let visible = rows;
  if (filterCol && filter && filter.value !== "") {
    visible = visible.filter((r) => matchesFilter(r.cells[filterCol.id] ?? null, filterCol, filter.value));
  }
  if (sortCol && sort) {
    const sign = sort.dir === "asc" ? 1 : -1;
    visible = [...visible].sort(
      (a, b) => sign * compare(a.cells[sortCol.id] ?? null, b.cells[sortCol.id] ?? null, sortCol.type)
    );
  }

  const updateColumn = (id: string, patch: Partial<Column>) =>
    onChange({ ...data, columns: columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const changeType = (col: Column, type: ColumnType) => {
    if (type === col.type) return;
    // Cell values from the old type aren't meaningful for the new one, so reset them.
    onChange({
      columns: columns.map((c) =>
        c.id === col.id ? { ...c, type, options: type === "select" ? c.options ?? ["Option 1"] : undefined } : c
      ),
      rows: rows.map((r) => ({ ...r, cells: { ...r.cells, [col.id]: emptyValue(type) } })),
    });
    if (filter?.colId === col.id) setFilter(null);
  };

  const deleteColumn = (id: string) => {
    onChange({
      columns: columns.filter((c) => c.id !== id),
      rows: rows.map((r) => {
        const { [id]: _removed, ...cells } = r.cells;
        return { ...r, cells };
      }),
    });
    if (sort?.colId === id) setSort(null);
    if (filter?.colId === id) setFilter(null);
    setOpenCol(null);
  };

  const addColumn = () =>
    onChange({ ...data, columns: [...columns, { id: newId(), name: `Column ${columns.length + 1}`, type: "text" }] });

  const addRow = () => onChange({ ...data, rows: [...rows, { id: newId(), cells: {} }] });

  const setCell = (rowId: string, colId: string, v: CellValue) =>
    onChange({
      ...data,
      rows: rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: v } } : r)),
    });

  const toggleSort = (colId: string) =>
    setSort((s) =>
      s?.colId !== colId ? { colId, dir: "asc" } : s.dir === "asc" ? { colId, dir: "desc" } : null
    );

  return (
    <div
      className="my-2 w-full rounded-lg border border-neutral-800 bg-neutral-900/40 text-neutral-200"
      style={frameStyle(color)}
    >
      <div className="flex items-center gap-2 border-b border-neutral-800 px-2 py-1.5 text-xs text-neutral-400">
        <StyleMenu color={color} icon={icon} iconColor={iconColor} editable={editable} onChange={onStyleChange} />
        <span>Filter</span>
        <select
          className="rounded bg-neutral-800 px-1.5 py-1 text-neutral-200"
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
        {filterCol &&
          (filterCol.type === "checkbox" ? (
            <select
              className="rounded bg-neutral-800 px-1.5 py-1 text-neutral-200"
              value={filter?.value ?? ""}
              onChange={(e) => setFilter({ colId: filterCol.id, value: e.target.value })}
            >
              <option value="">Any</option>
              <option value="true">Checked</option>
              <option value="false">Unchecked</option>
            </select>
          ) : (
            <input
              className="rounded bg-neutral-800 px-1.5 py-1 text-neutral-200 outline-none"
              placeholder="contains…"
              value={filter?.value ?? ""}
              onChange={(e) => setFilter({ colId: filterCol.id, value: e.target.value })}
            />
          ))}
        {filter && (
          <button onClick={() => setFilter(null)} aria-label="Clear filter">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: `${columns.length * 9 + 2}rem` }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.id} data-col-menu={col.id} className="relative min-w-36 border-b border-r border-neutral-800 text-left font-medium">
                  <div className="flex items-center">
                    <input
                      className={`${inputClass} font-medium`}
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
                      }}
                    />
                    <button
                      className="px-1 text-neutral-500 hover:text-neutral-200"
                      onClick={() => toggleSort(col.id)}
                      aria-label={`Sort by ${col.name}`}
                    >
                      {sort?.colId === col.id ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-purple-400" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-purple-400" />
                        )
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {editable && (
                      <button
                        className="px-1 text-neutral-500 hover:text-neutral-200"
                        onClick={() => setOpenCol(openCol === col.id ? null : col.id)}
                        aria-label={`Configure ${col.name}`}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {openCol === col.id && (
                    <div className="absolute left-0 top-full z-20 mt-1 w-56 space-y-2 rounded-md border border-neutral-700 bg-neutral-900 p-2 text-xs shadow-lg">
                      <label className="block text-neutral-400">
                        Type <span className="text-neutral-500">(changing it clears this column&apos;s values)</span>
                        <select
                          className="mt-1 w-full rounded bg-neutral-800 px-1.5 py-1 text-neutral-200"
                          value={col.type}
                          onChange={(e) => changeType(col, e.target.value as ColumnType)}
                        >
                          {COLUMN_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                      {col.type === "select" && (
                        <label className="block text-neutral-400">
                          Options (comma separated)
                          <input
                            className="mt-1 w-full rounded bg-neutral-800 px-1.5 py-1 text-neutral-200 outline-none"
                            key={(col.options ?? []).join(",")}
                            defaultValue={(col.options ?? []).join(", ")}
                            onBlur={(e) =>
                              updateColumn(col.id, {
                                options: e.target.value
                                  .split(",")
                                  .map((o) => o.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </label>
                      )}
                      <button
                        className="flex items-center gap-1 text-red-400 hover:text-red-300"
                        onClick={() => deleteColumn(col.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete column
                      </button>
                    </div>
                  )}
                </th>
              ))}
              {editable && (
                <th className="w-10 border-b border-neutral-800">
                  <button
                    className="px-2 py-1.5 text-neutral-500 hover:text-neutral-200"
                    onClick={addColumn}
                    aria-label="Add column"
                  >
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
                      value={row.cells[col.id] ?? null}
                      editable={editable}
                      onChange={(v) => setCell(row.id, col.id, v)}
                    />
                  </td>
                ))}
                {editable && (
                  <td className="border-b border-neutral-800 text-center">
                    <button
                      className="px-2 text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                      onClick={() => onChange({ ...data, rows: rows.filter((r) => r.id !== row.id) })}
                      aria-label="Delete row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editable && (
        <button
          className="flex w-full items-center gap-1 px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-200"
          onClick={addRow}
        >
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
            onChange={(next) => {
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
