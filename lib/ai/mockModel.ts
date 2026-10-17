// Deterministic stand-in for Gemini, used only when ORBIT_AI_MOCK=1 (see model.ts).
//
// It behaves like a model that follows Orbit's guidance, so the plumbing around it can be tested
// without live API calls: answers questions directly, asks grouped clarifying questions for vague
// edit requests, and only calls propose_edit once the request is clear. It does NOT measure how well
// real Gemini follows the clarification-first rules; that needs live verification.
//
// Every reply starts with "[mock]" so mocked output can never be mistaken for a live response.
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

const EDIT_VERB = /\b(add|insert|change|replace|rename|delete|remove|update|rewrite|fill|reorganize|reorganise)\b/i;
const BEST_JUDGMENT = /best judg(?:e)?ment|use your judg(?:e)?ment|reasonable assumptions|you decide/i;
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

type Decision = { text: string; operations?: Record<string, unknown>[] };

const textOf = (content: unknown): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((p: any) => (p?.type === "text" ? p.text : "")).join("")
      : "";

const quoted = (s: string) => [...s.matchAll(/['"“‘]([^'"”’]+)['"”’]/g)].map((m) => m[1].trim());

function decide(prompt: any[]): Decision {
  const system = textOf(prompt.find((m) => m.role === "system")?.content);
  const hasNote = system.includes("CURRENT NOTE:");
  if (hasNote && !system.includes("Clarification first")) return { text: "[mock] ERROR: clarification guidance was not in the system prompt." };

  const turns = prompt.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role as string, text: textOf(m.content) }));
  const lastUser = turns.length - 1 - [...turns].reverse().findIndex((t) => t.role === "user");

  // The current edit conversation starts at the latest edit request; it continues while the assistant
  // has only asked questions since then. Anything else (a proposal, applied/rejected notices) ends it.
  let start = -1;
  for (let i = lastUser; i >= 0; i--) {
    if (turns[i].role === "user" && EDIT_VERB.test(turns[i].text)) start = i; // keep going: earliest request in this segment wins
    if (turns[i].role === "assistant" && !turns[i].text.includes("?")) break;
  }
  if (start === -1 || !hasNote) return { text: `[mock] Direct answer to: ${turns[lastUser]?.text.slice(0, 80) ?? ""}` };

  const task = turns.slice(start).filter((t) => t.role === "user").map((t) => t.text).join(" \n ");
  const judgment = BEST_JUDGMENT.test(task);
  const q = quoted(task);
  const lines = [...system.matchAll(/^\s*\{b(\d+)\} (.*)$/gm)].map((m) => ({ ref: `b${m[1]}`, line: m[2] }));
  const find = (needle: string) => lines.find((l) => l.line.includes(needle));
  const strip = (l: string) => l.replace(/^(#{1,6} |- \[[ x]\] |- |\d+\. |> )/, "");
  const ask = (items: string[]): Decision => ({
    text: `[mock] Quick check before I change anything:\n${items.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
  });

  if (/\bheading\b/i.test(task) && /\badd\b/i.test(task)) {
    const title = q[0];
    const where = /at the (end|bottom)/i.test(task) ? "end" : /at the (start|beginning|top)/i.test(task) ? "start" : null;
    const after = /after ['"“]([^'"”]+)['"”]/i.exec(task)?.[1];
    const questions: string[] = [];
    if (!title) questions.push("What should the heading say? (for example 'Next steps')");
    if (!where && !after && !judgment) questions.push("Where should it go: at the start, at the end, or after a specific line?");
    if (questions.length) return ask(questions);
    const target = after ? find(after) : undefined;
    if (after && !target) return ask([`I can't find '${after}' in this note. Which line did you mean?`]);
    return {
      text: `[mock] I've prepared a change: add the heading "${title}".`,
      operations: [{ op: "insert", after: target ? target.ref : where ?? "end", blocks: [{ type: "heading", text: title, level: 2 }] }],
    };
  }

  if (/\b(change|replace|update|rename)\b/i.test(task)) {
    if (q.length < 2) return ask([q.length ? "What should it say instead? (for example 'Updated intro')" : "Which text should change, and what should it become? (for example change 'Old text' to 'New text')"]);
    const hit = find(q[0]);
    if (!hit) return ask([`I can't find '${q[0]}' in this note. Which line did you mean?`]);
    return { text: `[mock] I've prepared a change: replace "${q[0]}" with "${q[1]}".`, operations: [{ op: "update", ref: hit.ref, text: strip(hit.line).replace(q[0], q[1]) }] };
  }

  if (/\b(delete|remove)\b/i.test(task)) {
    if (!q.length) return ask(["Which line should I remove? (quote its text, for example 'Old text')"]);
    const hit = find(q[0]);
    if (!hit) return ask([`I can't find '${q[0]}' in this note. Which line did you mean?`]);
    return { text: `[mock] I've prepared a change: remove "${q[0]}".`, operations: [{ op: "delete", ref: hit.ref }] };
  }

  return ask(["What exactly should I change? (for example: add a heading, change a line, or remove a line)"]);
}

export function createMockModel() {
  return new MockLanguageModelV4({
    doStream: async (options: any) => {
      const d = decide(options.prompt);
      const chunks: any[] = [{ type: "text-start", id: "t1" }, { type: "text-delta", id: "t1", delta: d.text }, { type: "text-end", id: "t1" }];
      if (d.operations) chunks.push({ type: "tool-call", toolCallId: "mock-call", toolName: "propose_edit", input: JSON.stringify({ operations: d.operations }) });
      chunks.push({ type: "finish", finishReason: { unified: d.operations ? "tool-calls" : "stop", raw: undefined }, logprobs: undefined, usage });
      return { stream: simulateReadableStream({ chunks, initialDelayInMs: 0, chunkDelayInMs: 0 }) };
    },
  });
}
