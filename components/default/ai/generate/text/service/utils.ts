import type { AIGenerationOptions } from "../../../types";
import { generateText } from "./generate";

/**
 * Generate text with a custom prompt (for the generate_text slash command)
 */
export async function generateTextFromPrompt(prompt: string): Promise<string> {
  try {
    console.log("🔮 Generating text from prompt:", `${prompt.substring(0, 50)}...`);

    const result = await generateText(prompt, {
      operation: `Generate text based on this description: ${prompt}`,
    });

    return result.response;
  } catch (error) {
    console.error("❌ Error generating text from prompt:", error);
    throw error;
  }
}
