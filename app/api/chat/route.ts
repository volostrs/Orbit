import { getChatModel, isMockAi } from "@/lib/ai/model";
import { jsonSchema, streamText, tool } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { buildNoteContextWithRefs, EDIT_GUIDANCE } from "@/lib/ai/translateNote";
import { buildProposal, PROPOSAL_MARKER, ProposalError } from "@/lib/ai/proposal";
import { addMessage, ChatLimitError, createConversation, getOwnedConversation, isUuid, recordUserTurn } from "@/lib/ai/conversations";

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

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Request: { noteId, conversationId | null, text, retry?, title? }.
// The client sends only the NEW message. The history comes from this conversation's own saved messages and
// the note context from the database, so a request can never carry another chat's messages or another note's
// content. The conversation must belong to the note (checked here, not trusted from the client). A null
// conversationId means "first prompt of a new chat": the chat is created now, under the 3-per-note limit.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const noteId = body?.noteId;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!isUuid(noteId)) return json(400, { error: "A valid note is required." });
    if (!text) return json(400, { error: "Message is empty." });
    if (text.length > 8000) return json(400, { error: "Message is too long." });
    const retry = body?.retry === true;

    // Context is limited to the one note this request is about, loaded fresh from the database and
    // translated for the model. Nothing else from the workspace is included. (No auth exists yet, so
    // this is scoping by note id, not per-user authorization.)
    const [note] = await db.select().from(notes).where(eq(notes.id, noteId));
    if (!note) return json(404, { error: "Note not found." });
    const built = buildNoteContextWithRefs(note);
    const refs = built.refs;
    const noteContext = `${built.context}\n\n${EDIT_GUIDANCE}`;

    let conversation: { id: string; title: string };
    if (body.conversationId === null || body.conversationId === undefined) {
      try {
        const title = typeof body.title === "string" && body.title.trim() ? body.title : text;
        conversation = await createConversation(note.id, title);
      } catch (err) {
        if (err instanceof ChatLimitError) return json(409, { error: err.message, code: "limit" });
        throw err;
      }
    } else {
      const found = await getOwnedConversation(note.id, String(body.conversationId));
      if (!found) return json(404, { error: "That chat does not belong to this note.", code: "not_found" });
      conversation = found;
    }

    const history = await recordUserTurn(conversation.id, text, retry);

    const systemPrompt = `You are Orbit AI, an intelligent executive functioning assistant for ADHD students. Keep your answers concise, clear, and actionable to prevent cognitive overload.\n\n${noteContext}`;

    const result = streamText({
      model: await getChatModel(), // Gemini, unless ORBIT_AI_MOCK=1 (dev/test only)
      system: systemPrompt,
      messages: history,
      tools: { propose_edit: proposeEdit },
    });

    // Plain text stream, as before. If the model asked for an edit, the validated proposal is appended
    // after the text behind PROPOSAL_MARKER, stamped with this note and conversation. The note is not
    // changed here, and the proposal itself is not saved: only the reply text is.
    const encoder = new TextEncoder();
    let cancelled = false;
    const stream = new ReadableStream({
      async start(controller) {
        let reply = "";
        let kind: "proposal" | null = null;
        const send = (s: string) => {
          reply += s;
        };
        const emit = (s: string) => {
          if (cancelled) return;
          try {
            controller.enqueue(encoder.encode(s));
          } catch {
            cancelled = true;
          }
        };
        try {
          let sawText = false;
          for await (const chunk of result.textStream) {
            if (cancelled) break;
            if (chunk) sawText = true;
            send(chunk);
            emit(chunk);
          }
          if (!cancelled) {
            const call = (await result.toolCalls).find((c) => c.toolName === "propose_edit");
            if (call) {
              try {
                const proposal = { ...buildProposal(note.id, note.content, refs, call.input), conversationId: conversation.id };
                if (!sawText) {
                  const msg = "I've prepared a proposed change for you to review.";
                  send(msg);
                  emit(msg);
                }
                kind = "proposal";
                emit(PROPOSAL_MARKER + JSON.stringify(proposal));
              } catch (err) {
                if (!(err instanceof ProposalError)) throw err;
                const msg = `${sawText ? "\n\n" : ""}I couldn't prepare a valid change (${err.message}). Please rephrase your request and I'll try again. Your note was not changed.`;
                send(msg);
                emit(msg);
              }
            }
          }
        } catch (err) {
          console.error("Chat stream error:", err instanceof Error ? err.message : err);
          emit("\n\nSomething went wrong while answering. Please try again.");
        } finally {
          // Save whatever reply text was produced (also a partial one if the user pressed Stop).
          if (reply.trim()) {
            try {
              await addMessage(conversation.id, "assistant", reply, kind);
            } catch (err) {
              console.error("Saving chat reply failed:", err instanceof Error ? err.message : err);
            }
          }
          try {
            controller.close();
          } catch {}
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Orbit-AI": isMockAi() ? "mock" : "gemini",
        "X-Orbit-Conversation": conversation.id,
        "X-Orbit-Conversation-Title": encodeURIComponent(conversation.title),
      },
    });
  } catch (error: any) {
    console.error("API Route Handler Error:", error instanceof Error ? error.message : error);
    return json(500, { error: "Failed to process chat request." });
  }
}
