import { google } from "@ai-sdk/google";

// Orbit's production provider is Gemini. A deterministic mock stands in ONLY when ORBIT_AI_MOCK=1 is set
// explicitly and the app is not running in production; it never replaces Gemini by default, and it
// exists so the chat/proposal pipeline can be tested without spending API quota.
export const isMockAi = () => process.env.ORBIT_AI_MOCK === "1" && process.env.NODE_ENV !== "production";

export async function getChatModel() {
  if (isMockAi()) {
    const { createMockModel } = await import("./mockModel");
    return createMockModel();
  }
  return google("gemini-3.8-flash");
}
