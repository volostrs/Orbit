import { streamText } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { getChatModel, isMockAi } from "@/lib/ai/model";
import { buildNoteContext } from "@/lib/ai/translateNote";
import { draftStats } from "@/lib/ai/draftAssist";

export const maxDuration = 30;

// Marker the mock model keys on; real Gemini just reads it as part of the instructions.
const ASSESS_INSTRUCTIONS = `DRAFT ASSESSMENT: decide whether this note is a draft with a clear, meaningful opportunity to improve its clarity, organization or completeness.
Reply with ONLY a JSON object: {"suggest": true|false, "reason": "<one short plain sentence>"}.
Use suggest=true only when an improvement would clearly help; if the note already reads well, or you are unsure, use false. Do not change or rewrite anything.`;

const headers = () => ({ "X-Orbit-AI": isMockAi() ? "mock" : "gemini" });
const no = (reason: string) => Response.json({ suggest: false, reason }, { headers: headers() });

// Read-only: loads ONE note by id, assesses it, and returns a yes/no. It never writes anything.
// (No auth exists yet, so this is scoping by note id, not per-user authorization.)
export async function POST(req: Request) {
  try {
    const { noteId } = await req.json();
    if (typeof noteId !== "string" || !noteId) return no("no note");

    let note: typeof notes.$inferSelect | undefined;
    try {
      [note] = await db.select().from(notes).where(eq(notes.id, noteId));
    } catch {
      return no("note not found");
    }
    if (!note) return no("note not found");

    // Cheap local checks first: the model is only asked about notes that look like real drafts.
    const stats = draftStats(note.content);
    if (!stats.eligible) return no(`not eligible: ${stats.reason}`);

    const result = streamText({
      model: await getChatModel(),
      system: `You are Orbit AI, an executive functioning assistant for ADHD students.\n\n${buildNoteContext(note)}\n\n${ASSESS_INSTRUCTIONS}`,
      messages: [{ role: "user", content: "Assess this note." }],
    });
    const text = await result.text;

    // Be strict: anything that is not a clear {"suggest": true} means do not bother the user.
    const json = /\{[\s\S]*\}/.exec(text)?.[0];
    let parsed: { suggest?: unknown; reason?: unknown } = {};
    try {
      parsed = json ? JSON.parse(json) : {};
    } catch {
      parsed = {};
    }
    const reason = typeof parsed.reason === "string" ? parsed.reason.slice(0, 160) : undefined;
    return Response.json({ suggest: parsed.suggest === true, reason }, { headers: headers() });
  } catch (error) {
    console.error("Assess note error:", error instanceof Error ? error.message : error);
    return Response.json({ suggest: false, error: "assessment failed" }, { status: 500, headers: headers() });
  }
}
