import { useDefaultModelStore } from "@/components/default/ai/models";
import type { Model } from "@/components/default/ai/models/types";
import type { AIGenerationOptions, AIGenerationResponse } from "../../../types";
import { getModels } from "@/components/default/ai/models/service/get";

/**
 * Generate text using the AI service
 */
export async function generateText(
  prompt: string,
  options: AIGenerationOptions = {},
  onCreditsUpdated?: (remainingCredits: number) => void | Promise<void>,
): Promise<AIGenerationResponse> {
  try {
    console.log("🔮 Generating text with AI service...", { prompt, options });

    // Get the user's default text model from the correct store
    let defaultTextModel = useDefaultModelStore.getState().textModel;
    console.log("CLIENT: AI-SERVICE: Current default text model:", defaultTextModel);

    // Fallback: if no text model is set, try to get a valid one from available models
    if (!defaultTextModel) {
      console.log("CLIENT: MISSING-MODEL: No default text model set, fetching available models");
      try {
        const modelsList = await getModels();
    const firstTextModel = modelsList.find(
      (m: Model) => {
        const modality = m.architecture?.modality as string | string[];
        const hasPromptPricing = m.pricing?.prompt && parseFloat(m.pricing.prompt) > 0;

        if (typeof modality === 'string') {
          return modality === "text->text" || modality === "text+image->text" || modality.includes("text->text") || modality === "text";
        }
        if (Array.isArray(modality)) {
          return modality.includes("text->text") || modality.includes("text+image->text") || modality.includes("text");
        }
        // If no modality info but has prompt pricing, consider it a text model
        return hasPromptPricing;
      },
    );
        if (firstTextModel) {
          defaultTextModel = firstTextModel.id;
          console.log("CLIENT: FALLBACK-MODEL: Using fallback text model:", defaultTextModel);
        }
      } catch (error) {
        console.error("CLIENT: MODEL-FETCH-ERROR: Failed to fetch models for fallback:", error);
      }
    }

    // Validate that we have a proper text model (not an image model)
    if (defaultTextModel?.includes("image")) {
      console.error("CLIENT: INVALID-MODEL: Image model selected for text generation:", defaultTextModel);
      throw new Error(
        `Invalid model selected for text generation: ${defaultTextModel}. Please select a text generation model.`,
      );
    }

    console.log("CLIENT: AI-SERVICE: Final model selection for text generation:", defaultTextModel);

    // Use the same endpoint as other AI tools in the app
    const response = await fetch("/api/ai/generate/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        option: "zap",
        command: options.operation || "Generate text based on the description",
        modelId: defaultTextModel,
      }),
    });

    if (!response.ok) {
      if (response.status === 503) {
        throw new Error("Ollama service not available. Please make sure Ollama is running locally.");
      } else if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      } else {
        const errorText = await response.text();
        throw new Error(errorText || `AI generation failed: ${response.status}`);
      }
    }

    // Parse the streaming response properly
    const text = await response.text();
    const lines = text.split("\n");
    let generatedText = "";

    for (const line of lines) {
      if (line.trim() === "") continue;

      // Handle the actual format: 0:"content"
      if (line.startsWith('0:"')) {
        // Extract the text content from the streaming format
        const content = line.substring(3, line.length - 1);
        if (content && content.trim() !== "") {
          generatedText += content;
        }
      }
    }

    // Clean up the generated text
    generatedText = generatedText
      .replace(/\\n/g, "\n") // Convert escaped newlines to actual newlines
      .replace(/^---\s*\n?/g, "") // Remove markdown separators at the start
      .replace(/\n---\s*\n?/g, "\n") // Remove markdown separators in the middle
      .replace(/^\s*Here's a text based on the description "[^"]*":\s*\n*/g, "") // Remove AI intro text
      .replace(/\n\s*Let me know if you need anything else!\s*$/g, "") // Remove AI outro text
      .trim();

    console.log("✅ AI generation completed successfully");

    // Update credits if callback provided (note: this function is for local models, no credits deducted)
    if (onCreditsUpdated) {
      try {
        // For local models, credits are not deducted, so we don't update
        console.log("ℹ️ Local model generation completed, no credit update needed");
      } catch (error) {
        console.error("Failed to update credits:", error);
      }
    }

    return {
      response: generatedText,
      operation: options.operation || "generate",
      model: "llama3.2", // Using Ollama model
    };
  } catch (error) {
    console.error("❌ Error with AI generation:", error);
    throw error;
  }
}
