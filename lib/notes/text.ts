// Plain-text views of a note's BlockNote document: a short preview for Dashboard cards and a Markdown export.
// The structured document stays the source of truth; nothing here writes to it.

type Block = { type?: string; props?: Record<string, any>; content?: unknown; children?: unknown };

const asBlocks = (v: unknown): Block[] => (Array.isArray(v) ? (v.filter((b) => b && typeof b === "object") as Block[]) : []);

function inline(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((c: any) => {
      if (!c || typeof c !== "object") return "";
      if (typeof c.text === "string") return c.text;
      if (c.type === "link") return inline(c.content);
      return "";
    })
    .join("");
}

function tableRows(content: any): string[][] {
  const rows = content?.type === "tableContent" && Array.isArray(content.rows) ? content.rows : [];
  return rows.map((r: any) => (Array.isArray(r?.cells) ? r.cells : []).map((c: any) => inline(Array.isArray(c) ? c : c?.content).replace(/\|/g, "\\|")));
}

function parseTable(data: unknown): { header: string[]; rows: string[][] } | null {
  try {
    const d = JSON.parse(String(data));
    if (!Array.isArray(d?.columns) || !Array.isArray(d?.rows)) return null;
    const cols: any[] = d.columns;
    const rows = d.rows.map((r: any) =>
      cols.map((c, i) => {
        const v = r?.cells?.[c?.id ?? `col-legacy-${i}`];
        if (c?.type === "checkbox") return v ? "yes" : "no";
        return v === null || v === undefined ? "" : String(v).replace(/\|/g, "\\|");
      })
    );
    return { header: cols.map((c, i) => String(c?.name ?? `Column ${i + 1}`).replace(/\|/g, "\\|")), rows };
  } catch {
    return null;
  }
}

const CUSTOM_LABEL: Record<string, string> = { dataTable: "a data table", habitTracker: "a habit tracker", chart: "a chart", calendar: "a calendar", clock: "a clock" };

// First readable text of a note, whitespace-collapsed and cut to `max` characters. Notes with no text but with
// special blocks get a short description instead of looking empty.
export function notePreview(content: unknown, max = 200): string {
  let out = "";
  const kinds = new Set<string>();
  const walk = (blocks: Block[]) => {
    for (const b of blocks) {
      if (out.length >= max) return;
      if (b.type && CUSTOM_LABEL[b.type]) kinds.add(CUSTOM_LABEL[b.type]);
      let text = "";
      if (b.type === "table") text = tableRows(b.content).map((r: string[]) => r.join(" ")).join(" ");
      else if (b.type === "codeBlock") text = inline(b.content);
      else text = inline(b.content);
      text = text.replace(/\s+/g, " ").trim();
      if (text) out += (out ? " " : "") + text;
      walk(asBlocks(b.children));
    }
  };
  walk(asBlocks(content));
  if (!out && kinds.size) return `Contains ${[...kinds].join(" and ")}`;
  return out.length > max ? out.slice(0, max).trimEnd() + "…" : out;
}

export function noteToMarkdown(title: string, content: unknown): string {
  const lines: string[] = [`# ${title || "Untitled"}`, ""];
  const walk = (blocks: Block[], depth: number) => {
    const pad = "  ".repeat(depth);
    let n = 0;
    for (const b of blocks) {
      const text = inline(b.content);
      n = b.type === "numberedListItem" ? n + 1 : 0;
      switch (b.type) {
        case "heading":
          lines.push(`${"#".repeat(Math.min(6, Math.max(1, Number(b.props?.level) || 1)) + 1)} ${text}`, "");
          break;
        case "bulletListItem":
          lines.push(`${pad}- ${text}`);
          break;
        case "numberedListItem":
          lines.push(`${pad}${n}. ${text}`);
          break;
        case "checkListItem":
          lines.push(`${pad}- [${b.props?.checked ? "x" : " "}] ${text}`);
          break;
        case "quote":
          lines.push(`> ${text}`, "");
          break;
        case "codeBlock":
          lines.push("```" + (b.props?.language && b.props.language !== "text" ? b.props.language : ""), text, "```", "");
          break;
        case "table": {
          const rows = tableRows(b.content);
          if (rows.length) {
            lines.push(`| ${rows[0].join(" | ")} |`, `| ${rows[0].map(() => "---").join(" | ")} |`);
            for (const r of rows.slice(1)) lines.push(`| ${r.join(" | ")} |`);
            lines.push("");
          }
          break;
        }
        case "dataTable": {
          const t = parseTable(b.props?.data);
          if (t && t.header.length) {
            lines.push(`| ${t.header.join(" | ")} |`, `| ${t.header.map(() => "---").join(" | ")} |`);
            for (const r of t.rows) lines.push(`| ${r.join(" | ")} |`);
            lines.push("");
          }
          break;
        }
        case "habitTracker":
        case "chart":
        case "calendar":
        case "clock":
          lines.push(`_(${b.type === "chart" ? "Chart" : b.type === "calendar" ? "Calendar" : b.type === "clock" ? "Clock" : "Habit tracker"} not included in text export)_`, "");
          break;
        default:
          if (text) lines.push(text, "");
      }
      walk(asBlocks(b.children), depth + 1);
    }
  };
  walk(asBlocks(content), 0);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
