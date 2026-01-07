/**
 * AI Image Generation Service
 * Handles image generation using OpenAI API with streaming support
 */

import { useUserSettingsStore } from "@/components/default/user";
import { getGlobalMockDelay, getGlobalMockMode } from "@/components/scriba/mock";

export interface ImageGenerationOptions {
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  quality?: "standard" | "hd";
}

export interface ImageGenerationResponse {
  url: string;
  prompt: string;
  size: string;
  revised_prompt?: string;
}

export interface StreamingImageEvent {
  type: "status" | "partial_image" | "complete" | "error";
  status?: "starting" | "in_progress" | "generating";
  message?: string;
  url?: string;
  prompt?: string;
  size?: string;
  revised_prompt?: string;
  error?: string;
  sourceFileIds?: string[];
}

export interface ImageEditOptions extends ImageGenerationOptions {
  sourceFileIds: string[];
}

/**
 * Generate an image using OpenAI API based on a text prompt
 * Credits are now handled server-side in the API
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {},
  _onCreditsUpdated?: (remainingCredits: number) => void,
): Promise<ImageGenerationResponse> {
  // Get mock settings from global state
  const mock = getGlobalMockMode();
  const mockDelay = getGlobalMockDelay();

  try {
    console.log("Generating image with OpenAI API...", { prompt, options, mock });

    // Credits are now deducted server-side in the API route
    // Note: API key check is also handled on the server side

    // Get selected model from user settings
    const defaultImageModel = useUserSettingsStore.getState().defaultImageModel;

    const response = await fetch("/api/ai/generate/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        options,
        mock,
        mockDelay,
        modelId: defaultImageModel, // Pass user's selected model
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Image generation failed: ${response.status}`);
    }

    const result = await response.json();

    // Update credits if callback provided and remaining credits available
    if (_onCreditsUpdated && result.remainingCredits !== undefined) {
      try {
        await _onCreditsUpdated(result.remainingCredits);
        console.log("✅ Credits updated after image generation:", result.remainingCredits);
      } catch (error) {
        console.error("Failed to update credits:", error);
      }
    }

    return {
      url: result.url,
      prompt: prompt,
      size: result.size || "1024x1024",
      revised_prompt: result.revised_prompt,
    };
  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to generate image");
  }
}

/**
 * Generate image with streaming support using Server-Sent Events
 */
export async function generateImageWithStreaming(
  prompt: string,
  onEvent: (event: StreamingImageEvent) => void,
  options: ImageGenerationOptions = {},
  _onCreditsUpdated?: (remainingCredits: number) => void,
): Promise<void> {
  // Get mock settings from global state
  const mock = getGlobalMockMode();
  const mockDelay = getGlobalMockDelay();

  try {
    console.log("🎨 Starting streaming image generation...", { prompt, options, mock });

    // Credits are now deducted server-side in the API route

    // Get selected model from user settings
    const defaultImageModel = useUserSettingsStore.getState().defaultImageModel;

    const response = await fetch("/api/ai/generate/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        options,
        stream: true,
        mock,
        mockDelay,
        modelId: defaultImageModel, // Pass user's selected model
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Image generation failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No response body available for streaming");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        buffer += chunk;

        // Process complete lines from the buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === "") continue;

          if (line.startsWith("data: ")) {
            const data = line.slice(6); // Remove 'data: ' prefix

            if (data === "[DONE]") {
              console.log("Streaming completed");
              return;
            }

            try {
              const event: StreamingImageEvent = JSON.parse(data);

              // Check if this is a complete event with remaining credits
              if (event.type === "complete" && "remainingCredits" in event && _onCreditsUpdated) {
                try {
                  await _onCreditsUpdated(event.remainingCredits as number);
                  console.log("✅ Credits updated after streaming image generation:", event.remainingCredits);
                } catch (creditError) {
                  console.error("Failed to update credits:", creditError);
                }
              }

              onEvent(event);
            } catch (parseError) {
              console.error("Error parsing streaming event:", parseError);
              // Only log parsing errors for non-empty data
              if (data.trim() !== "") {
                // Try to extract just the type to see what kind of event this might be
                const typeMatch = data.match(/"type"\s*:\s*"([^"]+)"/);
                if (typeMatch) {
                  console.log("🔍 Event type detected:", typeMatch[1]);
                }
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error("Error with streaming image generation:", error);
    onEvent({
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

/**
 * Generate image with progress updates (legacy method for backward compatibility)
 * Note: This now uses the streaming method internally
 */
export async function generateImageWithProgress(
  prompt: string,
  onProgress: (progress: number, message: string) => void,
  onComplete: (imageUrl: string) => void,
  onError: (error: string) => void,
  options: ImageGenerationOptions = {},
): Promise<void> {
  let progress = 0;

  await generateImageWithStreaming(
    prompt,
    (event) => {
      switch (event.type) {
        case "status":
          if (event.status === "starting") {
            progress = 10;
            onProgress(progress, event.message || "Starting...");
          } else if (event.status === "in_progress") {
            progress = 30;
            onProgress(progress, event.message || "In progress...");
          } else if (event.status === "generating") {
            progress = 60;
            onProgress(progress, event.message || "Generating...");
          }
          break;

        case "complete":
          progress = 100;
          onProgress(progress, "Complete!");
          if (event.url) {
            onComplete(event.url);
          }
          break;

        case "error":
          onError(event.error || "Unknown error");
          break;
      }
    },
    options,
  );
}

/**
 * Edit an image using OpenAI API based on a text prompt and source images
 */
export async function editImage(
  prompt: string,
  sourceFileIds: string[],
  options: ImageGenerationOptions = {},
  _onCreditsUpdated?: (remainingCredits: number) => void,
): Promise<ImageGenerationResponse> {
  // Get mock settings from global state
  const mock = getGlobalMockMode();
  const mockDelay = getGlobalMockDelay();

  try {
    console.log("Editing image with OpenAI API...", { prompt, sourceFileIds, options, mock });

    // Credits are now deducted server-side in the API route
    // Note: API key check is handled on the server side

    const response = await fetch("/api/ai/generate/image/edit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        sourceFileIds,
        options,
        mock,
        mockDelay,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Image edit failed: ${response.status}`);
    }

    const result = await response.json();

    return {
      url: result.url,
      prompt: prompt,
      size: result.size || "1024x1024",
      revised_prompt: result.revised_prompt,
    };
  } catch (error) {
    console.error("Error editing image:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to edit image");
  }
}

/**
 * Edit image with streaming support using Server-Sent Events
 */
export async function editImageWithStreaming(
  prompt: string,
  sourceFileIds: string[],
  onEvent: (event: StreamingImageEvent) => void,
  options: ImageGenerationOptions = {},
  _onCreditsUpdated?: (remainingCredits: number) => void,
): Promise<void> {
  // Get mock settings from global state
  const mock = getGlobalMockMode();
  const mockDelay = getGlobalMockDelay();

  try {
    console.log("🎨 Starting streaming image edit...", { prompt, sourceFileIds, options, mock });

    // Credits are now deducted server-side in the API route

    const response = await fetch("/api/ai/generate/image/edit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        sourceFileIds,
        options,
        stream: true,
        mock,
        mockDelay,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Image edit failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No response body available for streaming");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        buffer += chunk;

        // Process complete lines from the buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === "") continue;

          if (line.startsWith("data: ")) {
            const data = line.slice(6); // Remove 'data: ' prefix

            if (data === "[DONE]") {
              console.log("Edit streaming completed");
              return;
            }

            try {
              const event: StreamingImageEvent = JSON.parse(data);
              onEvent(event);
            } catch (parseError) {
              console.error("Error parsing streaming event:", parseError);
              // Only log parsing errors for non-empty data
              if (data.trim() !== "") {
                // Try to extract just the type to see what kind of event this might be
                const typeMatch = data.match(/"type"\s*:\s*"([^"]+)"/);
                if (typeMatch) {
                  console.log("🔍 Event type detected:", typeMatch[1]);
                }
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error("Error with streaming image edit:", error);
    onEvent({
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}
