import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const maxDuration = 10;

export async function POST(req: Request) {
  try {
    const { messages, noteContent } = await req.json();

    const systemPrompt = `You are Orbit AI, an intelligent executive functioning assistant for ADHD students. Keep your answers concise, clear, and actionable to prevent cognitive overload.${
      noteContent ? `\n\n--- CURRENT ACTIVE NOTE CONTENT ---\n${noteContent}\n----------------------------------` : ""
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