import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { generateTextWithStreaming } from "./service/aiService";
import { useNotificationStore } from "../../../notifications/stores/notificationStore";
import { fileSelectionStore } from "../../../../scriba/file-management/stores/fileSelectionStore";

// Stream preview plugin key
export const streamPreviewKey = new PluginKey("streamPreview");

// Stream preview plugin - shows streaming text as a decoration
function StreamPreviewPlugin() {
  return new Plugin({
    key: streamPreviewKey,
    state: {
      init: () => ({ pos: null as number | null, text: "" }),
      apply(tr, prev) {
        const meta = tr.getMeta(streamPreviewKey) as { pos?: number | null; text?: string } | undefined;
        const next = { ...prev };
        if (meta?.pos !== undefined) next.pos = meta.pos;
        if (meta?.text !== undefined) next.text = meta.text;
        return next;
      },
    },
    props: {
      decorations(state) {
        const pluginState = this.getState(state);
        if (pluginState.pos == null) return DecorationSet.empty;

        const widget = Decoration.widget(pluginState.pos, () => {
          const container = document.createElement("div");
          container.setAttribute("data-ai-stream", "1");
          container.style.opacity = "0.8";
          container.style.color = "#666";
          container.style.fontStyle = "italic";
          container.style.whiteSpace = "pre-wrap";
          container.style.maxWidth = "100%";
          container.style.overflowWrap = "break-word";

          // Show placeholder or formatted streaming text
          let previewText = pluginState.text;

          // If we only have the placeholder, show it as-is
          if (previewText === "") {
            container.textContent = "Generating..";
            return container;
          }

          // Better preview formatting - convert markdown to readable text with proper line breaks
          previewText = previewText
            // Clean up escaped sequences first
            .replace(/\\n\\n/g, "\n\n")
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            // Remove AI boilerplate
            .replace(/^\s*Here's a text based on the description "[^"]*":\s*\n*/g, "")
            .replace(/\n\s*Let me know if you need anything else!\s*$/g, "")
            .replace(/^---\s*\n?/g, "")
            .replace(/\n---\s*\n?/g, "\n")
            .replace(/^\.+\s*/, "") // Remove leading dots
            .trim();

          // Format for better readability during streaming - PRESERVE line breaks
          previewText = previewText
            .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold markers but keep text
            .replace(/\*(.*?)\*/g, "$1") // Remove italic markers but keep text
            .replace(/(\d+)\.\s*/g, "$1. ") // Ensure proper spacing after numbers
            .replace(/\n\n\n+/g, "\n\n") // Normalize excessive paragraph breaks to double
            .replace(/[ \t]+/g, " ") // Normalize spaces and tabs, but keep newlines
            .trim();

          // Show all text with preserved line breaks
          container.textContent = previewText;
          return container;
        });

        return DecorationSet.create(state.doc, [widget]);
      },
    },
  });
}

// Simple markdown to HTML converter using basic patterns
const markdownToHtml = (markdown: string): string => {
  const cleaned = markdown
    .replace(/\\n\\n/g, "\n\n")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/^\s*Here's a text based on the description "[^"]*":\s*\n*/g, "")
    .replace(/\n\s*Let me know if you need anything else!\s*$/g, "")
    .replace(/^---\s*\n?/g, "")
    .replace(/\n---\s*\n?/g, "\n")
    .replace(/^\.+\s*/, "") // Remove leading dots
    .trim();

  return cleaned
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((paragraph) => {
      const formatted = paragraph
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/(\d+)\.\s+/g, "<strong>$1.</strong> ") // Fix numbered lists
        .replace(/\n/g, "<br>");
      return `<p>${formatted}</p>`;
    })
    .join("");
};

// Helper function to generate text from prompt using decoration-based streaming
export const generateTextFromPrompt = async (
  editor: Editor,
  prompt: string,
  onCreditsUpdated?: (remainingCredits: number) => void | Promise<void>,
  selectedSourceFileIds?: string[],
  documentId?: string,
  // Optional explicit insertion point (useful when command line is removed
  // and the selection moves) — if provided, the preview and final content
  // will be inserted at this position.
  insertAt?: number,
) => {
  try {
    // Use the explicit insertion position when provided otherwise fall back
    // to the current selection. Important: callers delete the command line
    // before calling this function, so relying on the selection may point
    // to a different line (hence the bug). Allowing callers to pass the
    // original position ensures correct placement.
    const startPos = typeof insertAt === "number" ? insertAt : editor.state.selection.from;

    // Start the streaming preview at the current position
    editor.view.dispatch(editor.state.tr.setMeta(streamPreviewKey, { pos: startPos, text: "" }));

    let buffer = "";

    await generateTextWithStreaming(
      prompt,
      // onChunk callback - update preview decoration only
      (chunk) => {
        console.log("Received chunk:", JSON.stringify(chunk));

        // Skip empty or placeholder chunks
        if (!chunk || chunk === "<>" || chunk.trim() === "") {
          return;
        }

        // Clean up escaped sequences
        const cleanChunk = chunk
          .replace(/\\n\\n/g, "\n\n")
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"');

        // Skip AI boilerplate chunks
        if (cleanChunk.match(/^Here's a text based on the description "[^"]*":\s*$/)) return;
        if (cleanChunk.match(/^Let me know if you need anything else!$/)) return;
        if (cleanChunk.match(/^---\s*$/)) return;

        // Accumulate content in buffer
        buffer += cleanChunk;

        // Update the preview decoration with current buffer
        editor.view.dispatch(editor.state.tr.setMeta(streamPreviewKey, { text: buffer }));
      },
      // onComplete callback - replace preview with formatted content
      (fullText) => {
        console.log("Text generation completed:", fullText);

        try {
          // Clean up the final buffer
          const cleaned = buffer
            .replace(/^\s*Here's a text based on the description "[^"]*":\s*\n*/g, "")
            .replace(/\n\s*Let me know if you need anything else!\s*$/g, "")
            .replace(/^---\s*\n?/g, "")
            .replace(/\n---\s*\n?/g, "\n")
            .replace(/^\.+\s*/, "") // Remove leading dots
            .trim();

          // Convert to HTML
          const htmlContent = markdownToHtml(cleaned);

          // Clear the preview decoration
          editor.view.dispatch(editor.state.tr.setMeta(streamPreviewKey, { pos: null, text: "" }));

          // Insert the final formatted content at the original position
          if (htmlContent) {
            editor.chain().focus().insertContentAt(startPos, htmlContent).run();
          }
        } catch (error) {
          console.warn("Failed to format final content:", error);
          // Fallback: insert plain text
          editor.view.dispatch(editor.state.tr.setMeta(streamPreviewKey, { pos: null, text: "" }));
          editor.chain().focus().insertContentAt(startPos, buffer).run();
        }

        // Focus the editor after completion
        editor.chain().focus().run();
      },
      // onError callback
      (errorMessage) => {
        console.error("Error generating text:", errorMessage);

        // Clear the preview decoration
        editor.view.dispatch(editor.state.tr.setMeta(streamPreviewKey, { pos: null, text: "" }));

        const { showError } = useNotificationStore.getState();
        showError(`Failed to generate text: ${errorMessage}`);
      },
      // onCreditsUpdated callback - pass undefined if not provided
      onCreditsUpdated || undefined,
      // selectedSourceFileIds callback
      selectedSourceFileIds,
      // documentId for instance model selection
      documentId,
    );
  } catch (error) {
    console.error("Error generating text:", error);

    // Clear any preview decoration
    editor.view.dispatch(editor.state.tr.setMeta(streamPreviewKey, { pos: null, text: "" }));

    // Show error message
    const errorMessage = error.message || "Failed to generate text. Please try again.";
    const { showError } = useNotificationStore.getState();
    showError(`Failed to generate text: ${errorMessage}`);
  }
};

export interface GenerateTextOptions {
  onCreditsUpdated?: (remainingCredits: number) => void | Promise<void>;
  documentId?: string;
}

export const GenerateTextExtension = Extension.create<GenerateTextOptions>({
  name: "generateText",

  addOptions() {
    return {
      onCreditsUpdated: undefined,
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const { onCreditsUpdated } = this.options;
    return [
      // Add the stream preview plugin
      StreamPreviewPlugin(),
      // Add the command handler plugin
      new Plugin({
        key: new PluginKey("generateText"),
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

              console.log("Extension: Checking line for generate_text command:", lineText);

              // Check if the line contains the generate_text command (more flexible regex)
              //Needs to be /generate_text "..."
              const generateTextRegex = /^\/generate_text\s*"([^"]*)"$/;
              const match = lineText.match(generateTextRegex);

              if (match) {
                console.log("Extension: Found generate_text command, prompt:", match[1]);
                event.preventDefault();

                const prompt = match[1];

                // Compute insertion position before deleting the command line
                // and delete the command line. We need an explicit insert
                // position because the selection after deletion may point to
                // the following line which caused the generated text to appear
                // on the wrong (next) line.
                const insertPos = lineStart;
                view.dispatch(state.tr.delete(lineStart, lineEnd + 1)); // +1 for the newline

                // Generate text based on the prompt
                if (prompt && prompt.trim() !== "Describe what text to generate...") {
                  if (editor) {
                    // Get selected source files directly from the store
                    const selectedSourceFileIds = Array.from(
                      fileSelectionStore.getState().globalSelectedItems,
                    ) as string[];
                    console.log("Extension: Selected source file IDs for text generation:", selectedSourceFileIds);
                    generateTextFromPrompt(
                      editor,
                      prompt,
                      onCreditsUpdated,
                      selectedSourceFileIds,
                      this.options.documentId,
                      insertPos,
                    );
                  } else {
                    console.error("Editor instance not available");
                    const { showError } = useNotificationStore.getState();
                    showError("Failed to generate text: Editor not available");
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
