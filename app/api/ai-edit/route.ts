import { google } from "@ai-sdk/google";
import { generateText } from "ai";

export async function POST(req: Request) {
  try {
    const { prompt, currentContent } = await req.json();

    const systemPrompt = `You are Orbit AI, an intelligent executive functioning assistant for ADHD students. 
Your job is to directly modify the user's document based on their request. 
Return ONLY the modified full document content. Do not include markdown code block backticks (\`\`\`), conversational intros, or explanations.`;

    const { text } = await generateText({
      model: google("gemini-3.8-flash"),
      system: systemPrompt,
      prompt: `CURRENT DOCUMENT:\n${currentContent}\n\nUSER REQUEST:\n${prompt}`,
    });

    return Response.json({ updatedContent: text });
  } catch (error: any) {
    console.error("AI Edit Route Error:", error);
    return Response.json({ error: error.message || "Failed to generate edits." }, { status: 500 });
  }
}