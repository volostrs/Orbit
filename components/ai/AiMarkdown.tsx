import type { ReactNode } from "react";

// Minimal renderer for assistant replies: paragraphs, headings, lists, fenced code, `code` and **bold**.
// No HTML is ever injected; everything is built as React nodes. Tolerates half-streamed input.

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-neutral-800 px-1 py-0.5 font-mono text-[12px] text-neutral-100">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-neutral-50">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "code"; text: string };

function parse(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith("```"); i++) code.push(lines[i]);
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: "h", text: heading[1] });
    } else if (bullet || numbered) {
      flush();
      const kind = bullet ? "ul" : "ol";
      const last = blocks[blocks.length - 1];
      const text = (bullet ?? numbered)![1];
      if (last && last.kind === kind) last.items.push(text);
      else blocks.push({ kind, items: [text] });
    } else if (!line.trim()) {
      flush();
    } else {
      para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export function AiMarkdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3">
      {parse(text).map((b, i) => {
        switch (b.kind) {
          case "h":
            return <h4 key={i} className="text-[13px] font-semibold text-neutral-50">{inline(b.text)}</h4>;
          case "ul":
            return (
              <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-neutral-600">
                {b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="flex list-decimal flex-col gap-1.5 pl-5 marker:text-neutral-500">
                {b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}
              </ol>
            );
          case "code":
            return (
              <pre key={i} className="overflow-x-auto rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 font-mono text-[12px] leading-5 text-neutral-200">
                {b.text}
              </pre>
            );
          default:
            return <p key={i}>{inline(b.text)}</p>;
        }
      })}
    </div>
  );
}
