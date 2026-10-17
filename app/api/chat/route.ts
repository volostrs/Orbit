import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { buildNoteContext } from "@/lib/ai/translateNote";

export const maxDuration = 10;

export async function POST(req: Request) {
  try {
    const { messages, noteId, noteContent } = await req.json();

    // Context is limited to the one note this request is about, loaded fresh from the database and
    // translated for the model. Nothing else from the workspace is included. (No auth exists yet, so
    // this is scoping by note id, not per-user authorization.)
    let noteContext = "";
    if (typeof noteId === "string" && noteId) {
      try {
        const [note] = await db.select().from(notes).where(eq(notes.id, noteId));
        if (note) noteContext = buildNoteContext(note);
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
      model: google("gemini-3.8-flash"),
      system: systemPrompt,
      messages: messages, // Pass the plain message objects directly
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("API Route Handler Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process chat request." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}