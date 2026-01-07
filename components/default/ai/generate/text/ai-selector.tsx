"use client";

import { useCompletion } from "@ai-sdk/react";
import { ArrowUp } from "lucide-react";
import { addAIHighlight, useEditor } from "novel";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { toast } from "sonner";
import { Command, CommandInput } from "@/components/tailwind/ui/command";
import { useCreditsStore } from "../../../credits";
import { Button } from "../../../../tailwind/ui/button";
import CrazySpinner from "../../../../tailwind/ui/icons/crazy-spinner";
import Magic from "../../../../tailwind/ui/icons/magic";
import { ScrollArea } from "../../../../tailwind/ui/scroll-area";
import AICompletionCommands from "./ai-completion-command";
import AISelectorCommands from "./ai-selector-commands";

// Matches the server-side markers
const CREDITS_MARKER = "\n<!--CREDITS:";
const CREDITS_MARKER_END = "-->";

/**
 * Extract credits info from completion text and return cleaned text
 */
function extractCreditsFromCompletion(text: string): { cleanText: string; credits?: number } {
  const markerIndex = text.lastIndexOf(CREDITS_MARKER);
  if (markerIndex === -1) {
    return { cleanText: text };
  }

  const endIndex = text.indexOf(CREDITS_MARKER_END, markerIndex);
  if (endIndex === -1) {
    return { cleanText: text };
  }

  const creditsStr = text.substring(markerIndex + CREDITS_MARKER.length, endIndex);
  const credits = parseInt(creditsStr, 10);
  const cleanText = text.substring(0, markerIndex);

  return {
    cleanText,
    credits: isNaN(credits) ? undefined : credits,
  };
}

//TODO: I think it makes more sense to create a custom Tiptap extension for this functionality https://tiptap.dev/docs/editor/ai/introduction

interface AISelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISelector({ onOpenChange }: AISelectorProps) {
  const { editor } = useEditor();
  const [inputValue, setInputValue] = useState("");
  const { updateCreditsFromResponse } = useCreditsStore();
  const [displayCompletion, setDisplayCompletion] = useState("");

  const { completion, complete, isLoading } = useCompletion({
    api: "/api/ai/generate/text",
    onFinish: (_prompt, rawCompletion) => {
      // Extract credits from the raw completion and update store
      const { cleanText, credits } = extractCreditsFromCompletion(rawCompletion);
      setDisplayCompletion(cleanText);

      if (credits !== undefined) {
        console.log("💳 AISelector: Updating credits from stream:", credits);
        updateCreditsFromResponse(credits);
      }
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  // Update display completion as streaming happens (strip credits marker if present)
  useEffect(() => {
    if (completion) {
      const { cleanText } = extractCreditsFromCompletion(completion);
      setDisplayCompletion(cleanText);
    } else {
      setDisplayCompletion("");
    }
  }, [completion]);

  if (!editor) {
    return null;
  }

  const hasCompletion = displayCompletion.length > 0;

  return (
    <Command className="w-[350px]">
      {hasCompletion && (
        <div className="flex max-h-[400px]">
          <ScrollArea>
            <div className="prose p-2 px-4 prose-sm">
              <Markdown>{displayCompletion}</Markdown>
            </div>
          </ScrollArea>
        </div>
      )}

      {isLoading && (
        <div className="flex h-12 w-full items-center px-4 text-sm font-medium text-muted-foreground text-purple-500">
          <Magic className="mr-2 h-4 w-4 shrink-0  " />
          AI is thinking
          <div className="ml-2 mt-1">
            <CrazySpinner />
          </div>
        </div>
      )}
      {!isLoading && (
        <>
          <div className="relative">
            <CommandInput
              value={inputValue}
              onValueChange={setInputValue}
              placeholder={hasCompletion ? "Tell AI what to do next" : "Ask AI to edit or generate..."}
              onFocus={() => editor && addAIHighlight(editor)}
            />
            <Button
              size="icon"
              className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-purple-500 hover:bg-purple-900"
              onClick={() => {
                if (!editor) return;

                if (displayCompletion)
                  return complete(displayCompletion, {
                    body: { option: "zap", command: inputValue },
                  }).then(() => setInputValue(""));

                const slice = editor.state.selection.content();
                const text = editor.storage.markdown.serializer.serialize(slice.content);

                complete(text, {
                  body: { option: "zap", command: inputValue },
                }).then(() => setInputValue(""));
              }}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
          {hasCompletion ? (
            <AICompletionCommands
              onDiscard={() => {
                if (editor) {
                  editor.chain().unsetHighlight().focus().run();
                }
                onOpenChange(false);
              }}
              completion={displayCompletion}
            />
          ) : (
            <AISelectorCommands onSelect={(value, option) => complete(value, { body: { option } })} />
          )}
        </>
      )}
    </Command>
  );
}
