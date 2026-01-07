import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { useNotificationStore } from "@/components/default/notifications";
import { fileSelectionStore } from "@/components/scriba/file-management/stores/fileSelectionStore";
import {
  editImageWithStreaming,
  generateImageWithStreaming,
  type StreamingImageEvent,
} from "./imageGenerationService";
import { insertGeneratingImage, updateImageById } from "./image-helpers";
import { removeCommandLine } from "@/components/scriba/editor/command-utils";

// Plugin key for managing image generation state
const imageGenerationKey = new PluginKey("imageGeneration");

// Helper function to generate image from prompt using the proper TipTap v3 pattern
export const generateImageFromPrompt = async (
  editor: any,
  prompt: string,
  addLocalSourceFile?: (sourceFile: any) => void,
  documentId?: string,
  onCreditsUpdated?: (remainingCredits: number) => void | Promise<void>,
  selectedSourceFileIds?: string[],
  rounded: boolean = true,
) => {
  try {
    console.log("🎨 Generating image for prompt:", prompt);

    // Parse size from prompt if provided (format: "prompt" 800x600)
    // Default to 800x600
    let actualPrompt = prompt;
    let sizeString = "800x600";
    let imageWidth = 800;
    let imageHeight = 600;

    // Check if prompt ends with a size specification (e.g., "prompt" 800x600)
    const sizeMatch = prompt.match(/\s+(\d+)x(\d+)$/);
    if (sizeMatch) {
      sizeString = `${sizeMatch[1]}x${sizeMatch[2]}`;
      imageWidth = parseInt(sizeMatch[1], 10);
      imageHeight = parseInt(sizeMatch[2], 10);
      actualPrompt = prompt.replace(/\s+\d+x\d+$/, "").trim();
    }

    // Check for selected source files to determine if we should edit or generate
    const isEditMode = selectedSourceFileIds && selectedSourceFileIds.length > 0;
    console.log("🎨 Edit mode:", isEditMode, "selected files:", selectedSourceFileIds);
    console.log("🎨 Image size:", sizeString, `(${imageWidth}x${imageHeight})`);

    // Insert a pending image node (will show loading effect instead of static image)
    // Use parsed dimensions or default to 800x600
    const imageId = insertGeneratingImage(editor, {
      previewSrc: null, // No preview image needed - loading effect will be shown
      alt: isEditMode ? `${actualPrompt} (editing from ${selectedSourceFileIds.length} source image(s))` : actualPrompt,
      width: imageWidth,
      height: imageHeight,
      rounded,
    });

    console.log("Inserted pending image with ID:", imageId);

    // Debug: Check if the image was inserted correctly
    setTimeout(() => {
      const imageElement = (document.querySelector(`img[data-id="${imageId}"]`) ||
        document.querySelector(`img[alt*="${prompt}"]`)) as HTMLImageElement | null;
      if (imageElement) {
        console.log("Found inserted image element:", imageElement);
        console.log("Image src:", imageElement.src);
        console.log("Image attributes:", imageElement.attributes);
      } else {
        console.log("No image element found with ID:", imageId);
      }
    }, 100);

    // Create a progress tracking object
    const _progressSteps = 0;
    const _totalSteps = 4; // starting, in_progress, generating, complete

    // Generate or edit the actual image using streaming
    let generationPromise: Promise<void>;

    const onEvent = async (event: StreamingImageEvent) => {
      console.log("Received streaming event:", event);

      switch (event.type) {
        case "status":
          // Check if this status event contains image data (fake partial frame)
          if (event.url?.startsWith("data:image/")) {
            console.log("🎨 Received status update with image:", `${event.url.substring(0, 100)}...`);

            // Update the image node with the image data
            const statusSuccess = updateImageById(editor, imageId, {
              src: event.url,
              status: "loaded", // Use 'loaded' so the actual image shows
              alt: `${prompt} - Generating... (Streaming)`,
              isGenerating: true, // Mark as generating to show blur pulse
            });

            if (!statusSuccess) {
              console.error("Failed to update image node with status image");
            } else {
              console.log("✅ Status image updated successfully");
            }
          } else {
            // Regular status update without image data
            updateImageById(editor, imageId, {
              status: "generating",
              alt: `${actualPrompt} - ${event.message}`,
            });

            // Log the streaming status
            console.log(`🔄 Streaming Status: ${event.status} - ${event.message}`);
          }
          break;

        case "partial_image": {
          console.log("🎨 Received partial image frame:", `${event.url.substring(0, 100)}...`);

          // Update the image node with the partial frame
          const partialSuccess = updateImageById(editor, imageId, {
            src: event.url,
            status: "loaded", // Use 'loaded' so the actual image shows instead of previewSrc
            alt: `${actualPrompt} - Generating... (Progressive)`,
            isGenerating: true, // Mark as generating to show blur pulse
          });

          if (!partialSuccess) {
            console.error("Failed to update image node with partial frame");
          } else {
            console.log("✅ Partial image frame updated successfully");
          }
          break;
        }

        case "complete": {
          console.log("Image generation completed:", event.url);

          // Convert blob URL to data URL for both editor and storage
          let finalImageUrl = event.url;
          if (event.url.startsWith("blob:")) {
            try {
              // Convert blob to data URL for persistent storage and editor
              const response = await fetch(event.url);
              const blob = await response.blob();
              finalImageUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
              console.log("✅ Converted blob URL to data URL for storage");
            } catch (conversionError) {
              console.warn("Failed to convert blob to data URL, using original:", conversionError);
              // Fall back to original blob URL if conversion fails
            }
          }

          // Update the image node with the final result (now using data URL)
          // Use the dimensions we set initially to maintain consistency
          // This prevents size jumps - we use the requested dimensions, not the actual image dimensions
          const success = updateImageById(editor, imageId, {
            src: finalImageUrl,
            status: "loaded",
            previewSrc: null,
            alt: actualPrompt,
            width: imageWidth, // Use the dimensions we parsed/set initially
            height: imageHeight, // Use the dimensions we parsed/set initially
            isGenerating: false, // Mark as complete to remove blur pulse
            rounded, // Preserve rounded setting
          });

          if (!success) {
            console.error("Failed to update image node with ID:", imageId);
          } else {
            console.log("✅ Image node updated successfully with final result");
          }

          // Credits are updated automatically by the image generation service

          // Save generated image as source file if we have document context
          if (addLocalSourceFile && documentId) {
            try {
              const fileName = `generated-image-${Date.now()}.png`;
              // Calculate fileSize from data URL
              let fileSize = 0;
              if (finalImageUrl.startsWith("data:")) {
                const dataUrlMatch = finalImageUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (dataUrlMatch) {
                  const base64Data = dataUrlMatch[2];
                  // Calculate actual file size from base64 (rough approximation)
                  fileSize = Math.floor((base64Data.length * 3) / 4);
                }
              } else if (typeof event.size === "number") {
                fileSize = event.size;
              } else if (typeof event.size === "string") {
                // Try to parse as number, otherwise use 0
                const parsed = parseInt(event.size, 10);
                fileSize = Number.isNaN(parsed) ? 0 : parsed;
              }

              console.log("🗂️ Saving generated image as source file:", {
                fileName,
                fileSize,
                finalImageUrl: `${finalImageUrl.substring(0, 50)}...`,
                documentId,
              });
              addLocalSourceFile({
                type: "local",
                fileType: "image",
                fileName: fileName,
                fileSize: fileSize,
                mimeType: "image/png",
                filePath: finalImageUrl, // Now a stable data URL
                timestamp: new Date(),
                documentId: documentId,
              });
              console.log("✅ Source file creation initiated for generated image");
            } catch (error) {
              console.warn("❌ Failed to save generated image as source file:", error);
              // Don't fail the generation if source file saving fails
            }
          } else {
            console.log("⚠️ Skipping source file creation - missing context:", {
              hasAddLocalSourceFile: !!addLocalSourceFile,
              documentId,
            });
          }

          // Focus the editor after completion
          editor.chain().focus().run();
          break;
        }

        case "error": {
          console.error("❌ Error generating image:", event.error);

          // Update the image node to show error state
          updateImageById(editor, imageId, {
            status: "error",
            previewSrc: null,
            alt: `Error: ${event.error}`,
            isGenerating: false, // Stop generating animation on error
          });

          const { showError } = useNotificationStore.getState();
          showError(`Failed to generate image: ${event.error}`);
          break;
        }
      }
    };

    if (isEditMode) {
      generationPromise = editImageWithStreaming(
        actualPrompt,
        selectedSourceFileIds,
        onEvent,
        {
          size: sizeString as any, // Allow any size string - API will validate
          quality: "standard",
        },
        onCreditsUpdated,
      );
    } else {
      generationPromise = generateImageWithStreaming(
        actualPrompt,
        onEvent,
        {
          size: sizeString as any, // Allow any size string - API will validate
          quality: "standard",
        },
        onCreditsUpdated,
      );
    }

    await generationPromise;
  } catch (error) {
    console.error("Error generating image:", error);
    const { showError } = useNotificationStore.getState();
    showError(`Failed to generate image: ${error.message || "Failed to generate image. Please try again."}`);
  }
};

export interface GenerateImageOptions {
  addLocalSourceFile?: (sourceFile: any) => void;
  documentId?: string;
  onCreditsUpdated?: (remainingCredits: number) => void | Promise<void>;
}

export const GenerateImageExtension = Extension.create<GenerateImageOptions>({
  name: "generateImage",

  addOptions() {
    return {
      addLocalSourceFile: undefined,
      documentId: undefined,
      onCreditsUpdated: undefined,
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const { addLocalSourceFile, documentId, onCreditsUpdated } = this.options;

    return [
      // Add the command handler plugin
      new Plugin({
        key: imageGenerationKey,
        props: {
          handleKeyDown: (view, event) => {
            // Check if Enter was pressed
            if (event.key === "Enter") {
              const { state } = view;
              const { selection } = state;
              const { from } = selection;

              // Get the current line of text
              const lineStart = state.doc.resolve(from).start();
              const lineEnd = state.doc.resolve(from).end();
              const lineText = state.doc.textBetween(lineStart, lineEnd);

              console.log("Extension: Checking line for generate_image command:", lineText);

              // Check if the line contains the generate_image command
              // Format: /generate_image "prompt" [800x600]
              // Size is optional, defaults to 800x600
              const generateImageRegex = /^\/generate_image\s*"([^"]*)"(?:\s+(\d+)x(\d+))?$/;
              const match = lineText.match(generateImageRegex);
              let prompt = match ? match[1] : null;

              // If size is provided, append it to prompt for parsing in generateImageFromPrompt
              if (match?.[2] && match?.[3]) {
                prompt = `${prompt} ${match[2]}x${match[3]}`;
              }

              if (prompt) {
                console.log("Extension: Found generate_image command, prompt:", prompt);
                event.preventDefault();

                // Remove the command line
                removeCommandLine(view, lineStart, lineEnd);

                // Generate image based on the prompt
                if (prompt && prompt.trim() !== "Describe what image to generate...") {
                  if (editor) {
                    // Get selected source files directly from the store
                    const selectedSourceFileIds = Array.from(
                      fileSelectionStore.getState().globalSelectedItems,
                    ) as string[];
                    console.log("Extension: Selected source file IDs:", selectedSourceFileIds);
                    generateImageFromPrompt(
                      editor,
                      prompt,
                      addLocalSourceFile,
                      documentId,
                      onCreditsUpdated,
                      selectedSourceFileIds,
                    );
                  } else {
                    console.error("Editor instance not available");
                    const { showError } = useNotificationStore.getState();
                    showError("Failed to generate image: Editor not available");
                  }
                }

                return true;
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});
