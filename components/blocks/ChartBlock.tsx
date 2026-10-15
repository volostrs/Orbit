"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { frameStyle, PALETTE, StyleMenu } from "./blockStyle";

type ChartType = "bar" | "line" | "pie";

interface ChartRow {
  id: string;
  label: string;
  value: number | null; // null = empty / invalid
}

interface ChartData {
  title: string;
  type: ChartType;
  rows: ChartRow[];
}

const DEFAULT_SERIES_COLOR = "#a855f7";
const TYPES: { id: ChartType; label: string }[] = [
  { id: "bar", label: "Bar" },
  { id: "line", label: "Line" },
  { id: "pie", label: "Pie" },
];

const exampleData = (): ChartData => ({
  title: "Weekly study hours",
  type: "bar",
  rows: [
    ["Mon", 2],
    ["Tue", 3.5],
    ["Wed", 1],
    ["Thu", 4],
    ["Fri", 2.5],
  ].map(([label, value]) => ({ id: crypto.randomUUID(), label: label as string, value: value as number })),
});

export const DEFAULT_CHART_DATA = () => JSON.stringify(exampleData());

// Fixed fallback ids keep a block with no/invalid saved data stable across renders.
function parseData(raw: string): ChartData {
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p?.rows)) {
      return {
        title: typeof p.title === "string" ? p.title : "",
        type: TYPES.some((t) => t.id === p.type) ? p.type : "bar",
        rows: p.rows.map((r: Partial<ChartRow>, i: number) => ({
          id: r.id ?? `row-${i}`,
          label: typeof r.label === "string" ? r.label : "",
          value: typeof r.value === "number" && Number.isFinite(r.value) ? r.value : null,
        })),
      };
    }
  } catch {}
  return { title: "", type: "bar", rows: [{ id: "row-0", label: "", value: null }] };
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const inputClass =
  "w-full bg-transparent px-2 py-1 text-sm text-neutral-200 outline-none focus:bg-neutral-800/60";

const W = 480;
const H = 220;
const M = { l: 40, r: 12, t: 16, b: 34 };

function axisScale(values: number[]) {
  const min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (max === min) max = min + 1;
  const y = (v: number) => M.t + ((max - v) / (max - min)) * (H - M.t - M.b);
  const ticks = [0, 1, 2, 3, 4].map((i) => min + ((max - min) * i) / 4);
  return { y, ticks, zero: y(0) };
}

function BarOrLine({ type, rows, color }: { type: "bar" | "line"; rows: ChartRow[]; color: string }) {
  const values = rows.flatMap((r) => (r.value === null ? [] : [r.value]));
  const { y, ticks, zero } = axisScale(values);
  const band = (W - M.l - M.r) / rows.length;
  const cx = (i: number) => M.l + band * (i + 0.5);

  // Line: split into segments so empty values leave a gap instead of being drawn as zero.
  const segments: string[] = [];
  let current: string[] = [];
  rows.forEach((r, i) => {
    if (r.value === null) {
      if (current.length) segments.push(current.join(" "));
      current = [];
    } else current.push(`${cx(i)},${y(r.value)}`);
  });
  if (current.length) segments.push(current.join(" "));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full text-neutral-400" role="img" aria-label="Chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.2} />
          <text x={M.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="currentColor">
            {fmt(t)}
          </text>
        </g>
      ))}
      <line x1={M.l} x2={W - M.r} y1={zero} y2={zero} stroke="currentColor" strokeOpacity={0.6} />
      {type === "bar" &&
        rows.map((r, i) => {
          if (r.value === null) return null;
          const bw = Math.min(band * 0.6, 48);
          const top = Math.min(y(r.value), zero);
          return (
            <rect
              key={r.id}
              data-bar
              data-value={r.value}
              x={cx(i) - bw / 2}
              y={top}
              width={bw}
              height={Math.max(Math.abs(y(r.value) - zero), 1)}
              rx={2}
              fill={color}
            >
              <title>{`${r.label || "(no label)"}: ${fmt(r.value)}`}</title>
            </rect>
          );
        })}
      {type === "line" && (
        <>
          {segments.map((pts, i) => (
            <polyline key={i} points={pts} fill="none" stroke={color} strokeWidth={2} />
          ))}
          {rows.map((r, i) =>
            r.value === null ? null : (
              <circle key={r.id} data-point data-value={r.value} cx={cx(i)} cy={y(r.value)} r={3.5} fill={color}>
                <title>{`${r.label || "(no label)"}: ${fmt(r.value)}`}</title>
              </circle>
            )
          )}
        </>
      )}
      {rows.map((r, i) => (
        <text key={r.id} x={cx(i)} y={H - M.b + 14} textAnchor="middle" fontSize={10} fill="currentColor">
          {clip(r.label, Math.max(3, Math.floor(band / 6)))}
        </text>
      ))}
    </svg>
  );
}

function Pie({ rows }: { rows: ChartRow[] }) {
  // Pie slices only make sense for positive values; empty, zero and negative rows are left out.
  const slices = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.value !== null && r.value > 0);
  const total = slices.reduce((s, { r }) => s + (r.value as number), 0);
  const skippedNegative = rows.some((r) => r.value !== null && r.value < 0);
  if (total === 0) {
    return <p className="py-6 text-center text-xs text-neutral-500">No positive values to show in a pie chart.</p>;
  }
  const R = 80;
  const C = 100;
  let angle = -Math.PI / 2;
  const colorOf = (i: number) => PALETTE[i % PALETTE.length].hex;
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <svg viewBox="0 0 200 200" className="h-auto w-full max-w-52" role="img" aria-label="Chart">
        {slices.map(({ r, i }) => {
          const frac = (r.value as number) / total;
          const a0 = angle;
          angle += frac * Math.PI * 2;
          const title = <title>{`${r.label || "(no label)"}: ${fmt(r.value as number)} (${Math.round(frac * 100)}%)`}</title>;
          if (slices.length === 1) {
            return (
              <circle key={r.id} data-slice cx={C} cy={C} r={R} fill={colorOf(i)}>
                {title}
              </circle>
            );
          }
          const [x0, y0] = [C + R * Math.cos(a0), C + R * Math.sin(a0)];
          const [x1, y1] = [C + R * Math.cos(angle), C + R * Math.sin(angle)];
          return (
            <path
              key={r.id}
              data-slice
              d={`M${C},${C} L${x0},${y0} A${R},${R} 0 ${frac > 0.5 ? 1 : 0} 1 ${x1},${y1} Z`}
              fill={colorOf(i)}
              stroke="#0a0a0a"
              strokeWidth={1}
            >
              {title}
            </path>
          );
        })}
      </svg>
      <ul className="space-y-1 text-xs text-neutral-300">
        {slices.map(({ r, i }) => (
          <li key={r.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorOf(i) }} />
            <span className="max-w-40 break-words">{r.label || "(no label)"}</span>
            <span className="text-neutral-500">
              {fmt(r.value as number)} · {Math.round(((r.value as number) / total) * 100)}%
            </span>
          </li>
        ))}
        {skippedNegative && <li className="text-neutral-500">Negative values aren’t shown in pie charts.</li>}
      </ul>
    </div>
  );
}

function Chart({
  data,
  editable,
  onChange,
  color,
  icon,
  iconColor,
  onStyleChange,
}: {
  data: ChartData;
  editable: boolean;
  onChange: (d: ChartData) => void;
  color: string;
  icon: string;
  iconColor: string;
  onStyleChange: (patch: { color?: string; icon?: string; iconColor?: string }) => void;
}) {
  const { rows } = data;
  const [dataOpen, setDataOpen] = useState(false);
  const setRow = (id: string, patch: Partial<ChartRow>) =>
    onChange({ ...data, rows: rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const hasValues = rows.some((r) => r.value !== null);

  return (
    <div
      className="my-2 w-full rounded-lg border border-neutral-800 bg-neutral-900/40 text-neutral-200"
      style={frameStyle(color)}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-2 py-1.5 text-xs">
        <StyleMenu color={color} icon={icon} iconColor={iconColor} editable={editable} onChange={onStyleChange} />
        <input
          className="min-w-32 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-neutral-600"
          placeholder="Chart title"
          aria-label="Chart title"
          readOnly={!editable}
          key={data.title}
          defaultValue={data.title}
          onBlur={(e) => e.target.value !== data.title && onChange({ ...data, title: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <div className="flex items-center gap-1" role="group" aria-label="Chart type">
          {TYPES.map((t) => (
            <button
              key={t.id}
              aria-pressed={data.type === t.id}
              disabled={!editable}
              onClick={() => onChange({ ...data, type: t.id })}
              className={`rounded border px-2 py-0.5 ${
                data.type === t.id
                  ? "border-neutral-300 bg-neutral-700 text-neutral-100"
                  : "border-neutral-700 text-neutral-400 hover:bg-neutral-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-3">
        {rows.length === 0 || (!hasValues && data.type !== "pie") ? (
          <p className="py-6 text-center text-xs text-neutral-500">Add a row with a value to see the chart.</p>
        ) : data.type === "pie" ? (
          <Pie rows={rows} />
        ) : (
          <BarOrLine type={data.type} rows={rows} color={color || DEFAULT_SERIES_COLOR} />
        )}
      </div>

      <div className="border-t border-neutral-800">
        <button
          className="flex w-full items-center gap-1 px-2 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
          aria-expanded={dataOpen}
          onClick={() => setDataOpen(!dataOpen)}
        >
          {dataOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Edit chart data
          <span className="text-neutral-600">({rows.length} {rows.length === 1 ? "row" : "rows"})</span>
        </button>
        {dataOpen && (
        <>
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="text-left text-[11px] font-medium text-neutral-500">
              <th className="px-2 py-1">Category</th>
              <th className="w-28 px-2 py-1">Value</th>
              {editable && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="group border-t border-neutral-800/60">
                <td>
                  <input
                    className={inputClass}
                    aria-label="Category label"
                    readOnly={!editable}
                    key={r.label}
                    defaultValue={r.label}
                    onBlur={(e) => e.target.value !== r.label && setRow(r.id, { label: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                </td>
                <td>
                  <input
                    className={inputClass}
                    type="number"
                    step="any"
                    aria-label="Value"
                    readOnly={!editable}
                    key={String(r.value)}
                    defaultValue={r.value === null ? "" : String(r.value)}
                    onBlur={(e) => {
                      const n = e.target.value === "" ? null : Number(e.target.value);
                      const next = n !== null && Number.isFinite(n) ? n : null;
                      if (next !== r.value) setRow(r.id, { value: next });
                      else e.target.value = next === null ? "" : String(next);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                </td>
                {editable && (
                  <td className="text-center">
                    <button
                      className="px-1 text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                      aria-label="Delete row"
                      onClick={() => onChange({ ...data, rows: rows.filter((x) => x.id !== r.id) })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {editable && (
          <div className="flex items-center justify-between px-2 py-1.5 text-xs text-neutral-500">
            <button
              className="flex items-center gap-1 hover:text-neutral-200"
              onClick={() => onChange({ ...data, rows: [...rows, { id: crypto.randomUUID(), label: "", value: null }] })}
            >
              <Plus className="h-3.5 w-3.5" /> Add row
            </button>
            <button className="hover:text-neutral-200" onClick={() => onChange({ ...data, rows: [] })}>
              Clear all
            </button>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}

export const chartBlock = createReactBlockSpec(
  {
    type: "chart",
    propSchema: {
      // JSON-serialised ChartData; lives in the block so it persists with notes.content.
      data: { default: "" },
      color: { default: "" },
      icon: { default: "" },
      iconColor: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => (
      <div className="w-full" contentEditable={false}>
        <Chart
          data={parseData(block.props.data)}
          editable={editor.isEditable}
          color={block.props.color}
          icon={block.props.icon}
          iconColor={block.props.iconColor}
          onStyleChange={(patch) => editor.updateBlock(block, { props: patch })}
          onChange={(next) => editor.updateBlock(block, { props: { data: JSON.stringify(next) } })}
        />
      </div>
    ),
  }
);
