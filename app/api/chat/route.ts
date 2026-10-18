import { getChatModel, isMockAi } from "@/lib/ai/model";
import { jsonSchema, streamText, tool } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { buildNoteContextWithRefs, EDIT_GUIDANCE } from "@/lib/ai/translateNote";
import { buildProposal, PROPOSAL_MARKER, ProposalError } from "@/lib/ai/proposal";

export const maxDuration = 30;

// The only way the model can change a note: ask for a proposal. It has no execute step, so calling it
// writes nothing; the server validates the call and sends it to the client for the user to review.
const BLOCK_TYPES = ["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "quote", "dataTable", "habitTracker", "chart"];
const proposeEdit = tool({
  description:
    "Propose edits to the current note for the user to review. Only use when the user asks to modify the note and you have enough information. Never applies changes by itself.",
  inputSchema: jsonSchema<{ operations: Record<string, unknown>[] }>({
    type: "object",
    properties: {
      operations: {
        type: "array",
        description: "Smallest set of edits, in order.",
        items: {
          type: "object",
          properties: {
            op: { type: "string", enum: ["insert", "update", "delete"] },
            ref: { type: "string", description: "update/delete: the block's ref, e.g. b3" },
            after: { type: "string", description: 'insert: a block ref, or "start" / "end"' },
            text: { type: "string", description: "update: new text for a text block" },
            type: { type: "string", enum: BLOCK_TYPES, description: "update: optionally change a text block's type. A dataTable/habitTracker/chart here (with data_json) replaces that text block with the new advanced block." },
            level: { type: "integer", description: "heading level 1-3" },
            checked: { type: "boolean" },
            data_json: { type: "string", description: "update of a dataTable/habitTracker/chart: the full new data as a JSON string" },
            blocks: {
              type: "array",
              description: "insert: the new blocks",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: BLOCK_TYPES },
                  text: { type: "string" },
                  level: { type: "integer" },
                  checked: { type: "boolean" },
                  data_json: { type: "string", description: "required for dataTable/habitTracker/chart" },
                },
                required: ["type"],
              },
            },
          },
          required: ["op"],
        },
      },
    },
    required: ["operations"],
  }),
});

export async function POST(req: Request) {
  try {
    const { messages, noteId, noteContent } = await req.json();

    // Context is limited to the one note this request is about, loaded fresh from the database and
    // translated for the model. Nothing else from the workspace is included. (No auth exists yet, so
    // this is scoping by note id, not per-user authorization.)
    let noteContext = "";
    let note: typeof notes.$inferSelect | undefined;
    let refs: string[] = [];
    if (typeof noteId === "string" && noteId) {
      try {
        [note] = await db.select().from(notes).where(eq(notes.id, noteId));
        if (note) {
          const built = buildNoteContextWithRefs(note);
          noteContext = `${built.context}\n\n${EDIT_GUIDANCE}`;
          refs = built.refs;
        }
      } catch {
        // Malformed id or lookup failure: continue without note context rather than failing the chat.
      }
    } else if (typeof noteContent === "string" && noteContent) {
      noteContext = `--- CURRENT ACTIVE NOTE CONTENT ---\n${noteContent}\n----------------------------------`;
    }

    const systemPrompt = `You are Orbit AI, an intelligent executive functioning assistant for ADHD students. Keep your answers concise, clear, and actionable to prevent cognitive overload.${
      noteContext ? `\n\n${noteContext}` : ""
    }`;

    const result = streamText({
      model: await getChatModel(), // Gemini, unless ORBIT_AI_MOCK=1 (dev/test only)
      system: systemPrompt,
      messages: messages, // Pass the plain message objects directly
      // Only offered when a specific note is loaded; a proposal is always tied to that note.
      ...(note ? { tools: { propose_edit: proposeEdit } } : {}),
    });

    // Plain text stream, as before. If the model asked for an edit, the validated proposal is appended
    // after the text behind PROPOSAL_MARKER. Nothing is saved here.
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (s: string) => controller.enqueue(encoder.encode(s));
        try {
          let sawText = false;
          for await (const chunk of result.textStream) {
            if (chunk) sawText = true;
            send(chunk);
          }
          const call = note ? (await result.toolCalls).find((c) => c.toolName === "propose_edit") : undefined;
          if (call && note) {
            try {
              const proposal = buildProposal(note.id, note.content, refs, call.input);
              if (!sawText) send("I've prepared a proposed change for you to review.");
              send(PROPOSAL_MARKER + JSON.stringify(proposal));
            } catch (err) {
              if (!(err instanceof ProposalError)) throw err;
              send(`${sawText ? "\n\n" : ""}I couldn't prepare a valid change (${err.message}). Please rephrase your request and I'll try again. Your note was not changed.`);
            }
          }
        } catch (err) {
          console.error("Chat stream error:", err);
          send("\n\nSomething went wrong while answering. Please try again.");
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Orbit-AI": isMockAi() ? "mock" : "gemini" },
    });
  } catch (error: any) {
    console.error("API Route Handler Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process chat request." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
