import { useDefaultModelStore } from "@/components/default/ai/models";
import type { Model } from "@/components/default/ai/models/types";
import { getModels } from "@/components/default/ai/models/service/get";
import { useInstanceModelStore } from "@/components/default/ai/models/defaults/stores/instanceModelStore";

/**
 * Generate text with streaming support (for real-time updates)
 */
export async function generateTextWithStreaming(
  prompt: string,
  onChunk: (text: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: string) => void,
  onCreditsUpdated?: (remainingCredits: number) => void | Promise<void>,
  sourceFileIds?: string[],
  documentId?: string,
): Promise<void> {
  try {
    console.log("🔮 Starting streaming AI generation:", `${prompt.substring(0, 50)}...`);

    // Check for instance model first (document-specific), then fall back to default
    let selectedModel = "";
    if (documentId) {
      const instanceModels = useInstanceModelStore.getState().overrides[documentId]?.models;
      selectedModel = instanceModels?.textModel || "";
      console.log("CLIENT: INSTANCE-MODEL: Document-specific text model:", selectedModel);
    }

    // Fall back to default model if no instance model
    if (!selectedModel) {
      selectedModel = useDefaultModelStore.getState().textModel;
      console.log("CLIENT: DEFAULT-MODEL: Using default text model:", selectedModel);
    }

    // Fallback: if no model is selected, try to get a valid one from available models
    if (!selectedModel) {
      console.log("CLIENT: MISSING-MODEL: No model selected, fetching available models");
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
          selectedModel = firstTextModel.id;
          console.log("CLIENT: FALLBACK-MODEL: Using fallback text model:", selectedModel);
        }
      } catch (error) {
        console.error("CLIENT: MODEL-FETCH-ERROR: Failed to fetch models for fallback:", error);
      }
    }

    // Validate that we have a proper text model (not an image model)
    if (selectedModel?.includes("image")) {
      console.error("CLIENT: INVALID-MODEL: Image model selected for text generation:", selectedModel);
      throw new Error(
        `Invalid model selected for text generation: ${selectedModel}. Please select a text generation model.`,
      );
    }

    const response = await fetch("/api/ai/generate/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        option: "zap",
        command: `Generate text based on this description: ${prompt}`,
        sourceFileIds: sourceFileIds,
        modelId: selectedModel,
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

    // Read the streaming response from the API
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body available");
    }

    const decoder = new TextDecoder();
    let generatedText = "";
    const CREDITS_MARKER = "\n<!--CREDITS:";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      generatedText += chunk;

      // Call onChunk with only the new chunk, not the accumulated text
      onChunk(chunk);
    }

    // Extract credits from the stream if present
    let cleanText = generatedText;
    let remainingCredits: number | undefined;
    
    const creditsIndex = generatedText.indexOf(CREDITS_MARKER);
    if (creditsIndex !== -1) {
      cleanText = generatedText.substring(0, creditsIndex);
      const endMarker = "-->";
      const endIndex = generatedText.indexOf(endMarker, creditsIndex);
      if (endIndex !== -1) {
        const creditsStr = generatedText.substring(creditsIndex + CREDITS_MARKER.length, endIndex);
        remainingCredits = parseInt(creditsStr, 10);
        if (isNaN(remainingCredits)) {
          remainingCredits = undefined;
        }
      }
    }

    console.log("✅ Streaming AI generation completed");
    onComplete(cleanText);


    // Update credits if callback provided
    if (onCreditsUpdated && remainingCredits !== undefined) {
      try {
        console.log("🔄 Updating credits after streaming text generation:", remainingCredits);
        await onCreditsUpdated(remainingCredits);
        console.log("✅ Credits updated after streaming text generation:", remainingCredits);
      } catch (error) {
        console.error("Failed to update credits:", error);
      }
    }
  } catch (error) {
    console.error("❌ Error with streaming AI generation:", error);
    onError(error instanceof Error ? error.message : "Unknown error occurred");
  }
}
