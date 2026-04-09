"use client";

import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { Bot, Loader2, MessageSquare, Settings2, SquarePen, User, Wrench } from "lucide-react";
import React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContentRight,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/tailwind/ui/drawer";
import { ScrollArea } from "@/components/tailwind/ui/scroll-area";
import { useAIProviderConfig } from "@/components/default/ai/providers/stores/aiProviderConfigStore";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { store } from "@/store/store";
import { apiUrl } from "@/lib/apiUrl";
import type { Model } from "@/components/default/ai/models/types";

import { getLevelContextSnapshot, readEditorContent, writeEditorContent } from "./editorTools";
import { useCreatorAiChatStore } from "./store";

type PersistedChatStatus = "idle" | "streaming" | "error";

type PersistedChatResponse = {
  chat?: {
    id: string;
    status: PersistedChatStatus;
    messages: UIMessage[];
    updatedAt: string;
    errorMessage?: string | null;
  };
};

function supportsToolUse(model: Model): boolean {
  if (model.supportsToolUse === true) {
    return true;
  }

  const supportedParameters = Array.isArray(model.supported_parameters)
    ? model.supported_parameters.map((value) => String(value).toLowerCase())
    : [];

  return supportedParameters.includes("tools") || supportedParameters.includes("tool_choice");
}

function getLevelChatStorageKey(levelStorageKey: string) {
  return `creator-ai-chat:${levelStorageKey}`;
}

function loadStoredMessages(levelStorageKey: string): UIMessage[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getLevelChatStorageKey(levelStorageKey));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to load creator AI chat history", error);
    return [];
  }
}

function persistStoredMessages(levelStorageKey: string, messages: UIMessage[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(getLevelChatStorageKey(levelStorageKey), JSON.stringify(messages));
  } catch (error) {
    console.warn("Failed to persist creator AI chat history", error);
  }
}

function clearStoredMessages(levelStorageKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(getLevelChatStorageKey(levelStorageKey));
  } catch (error) {
    console.warn("Failed to clear creator AI chat history", error);
  }
}

function areMessagesEqual(left: UIMessage[], right: UIMessage[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getLanguageLabel(language: unknown) {
  const value = String(language || "").toLowerCase();
  if (value === "html") return "HTML";
  if (value === "css") return "CSS";
  if (value === "js") return "JS";
  return value.toUpperCase();
}

function getCodeFenceLanguage(language: unknown) {
  const value = String(language || "").toLowerCase();
  if (value === "js") return "javascript";
  return value || "text";
}

function renderCodeBlock(code: string, language: unknown) {
  return (
    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-background/80 p-3 text-xs [overflow-wrap:anywhere]">
      <code className={`language-${getCodeFenceLanguage(language)} whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>{code}</code>
    </pre>
  );
}

function renderInlineFormatting(text: string) {
  const segments = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return segments.map((segment, index) => {
    if (segment.startsWith("`") && segment.endsWith("`")) {
      return (
        <code
          key={`${segment}-${index}`}
          className="rounded bg-background/80 px-1 py-0.5 font-mono text-[0.95em] break-words [overflow-wrap:anywhere]"
        >
          {segment.slice(1, -1)}
        </code>
      );
    }

    if (segment.startsWith("**") && segment.endsWith("**")) {
      return <strong key={`${segment}-${index}`}>{segment.slice(2, -2)}</strong>;
    }

    return <React.Fragment key={`${segment}-${index}`}>{segment}</React.Fragment>;
  });
}

function renderMarkdownLikeText(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nodes: React.ReactNode[] = [];
  let index = 0;

  const flushParagraph = (paragraphLines: string[]) => {
    if (paragraphLines.length === 0) {
      return;
    }

    nodes.push(
      <p key={`p-${nodes.length}`} className="whitespace-pre-wrap break-words text-sm leading-6">
        {renderInlineFormatting(paragraphLines.join(" "))}
      </p>,
    );
  };

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim() || "text";
      index += 1;
      const codeLines: string[] = [];

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      nodes.push(
        <pre
          key={`code-${nodes.length}`}
          className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-background/80 p-3 text-xs [overflow-wrap:anywhere]"
        >
          <code className={`language-${language} whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>
            {codeLines.join("\n")}
          </code>
        </pre>,
      );
      continue;
    }

    const headingMatch = trimmed.match(/^\*\*(.+)\*\*:?\s*$/);
    if (headingMatch) {
      nodes.push(
        <div key={`h-${nodes.length}`} className="text-sm font-semibold">
          {headingMatch[1]}
        </div>,
      );
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed) || /^-\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed);
      const items: string[] = [];

      while (index < lines.length) {
        const current = lines[index].trim();
        if (ordered && /^\d+\.\s+/.test(current)) {
          items.push(current.replace(/^\d+\.\s+/, ""));
          index += 1;
          continue;
        }
        if (!ordered && /^-\s+/.test(current)) {
          items.push(current.replace(/^-\s+/, ""));
          index += 1;
          continue;
        }
        break;
      }

      const ListTag = ordered ? "ol" : "ul";
      nodes.push(
        <ListTag
          key={`list-${nodes.length}`}
          className={ordered ? "list-decimal space-y-1 pl-5 text-sm break-words [overflow-wrap:anywhere]" : "list-disc space-y-1 pl-5 text-sm break-words [overflow-wrap:anywhere]"}
        >
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} className="break-words [overflow-wrap:anywhere]">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (
        !current
        || current.startsWith("```")
        || /^\*\*.+\*\*:?\s*$/.test(current)
        || /^\d+\.\s+/.test(current)
        || /^-\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }

    flushParagraph(paragraphLines);
  }

  return <div className="space-y-3 break-words [overflow-wrap:anywhere]">{nodes}</div>;
}

function renderToolSummary(part: any) {
  const toolName = String(part.type || "").replace(/^tool-/, "");
  const titleMap: Record<string, string> = {
    getLevelContext: "Read Level Context",
    readEditorContent: "Read Editor",
    writeEditorContent: "Write Editor",
  };

  const title = titleMap[toolName] || toolName;
  const stateLabel =
    part.state === "output-available"
      ? "Done"
      : part.state === "output-error"
        ? "Error"
        : "Running";

  if (toolName === "getLevelContext") {
    const output = part.output as
      | {
          levelName?: string;
          activeEditor?: { target?: string; language?: string };
          primaryDimensions?: { width?: number; height?: number; unit?: string };
        }
      | undefined;

    return (
      <div className="rounded-md border border-border/70 bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wrench className="h-4 w-4" />
            <span>{title}</span>
          </div>
          <span className="text-xs text-muted-foreground">{stateLabel}</span>
        </div>
        {output ? (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {output.levelName ? <div>Level: {output.levelName}</div> : null}
            {output.activeEditor ? (
              <div>
                Active editor: {output.activeEditor.target} {getLanguageLabel(output.activeEditor.language)}
              </div>
            ) : null}
            {output.primaryDimensions ? (
              <div>
                Dimensions: {output.primaryDimensions.width} × {output.primaryDimensions.height}
                {output.primaryDimensions.unit || "px"}
              </div>
            ) : null}
          </div>
        ) : null}
        {part.state === "output-error" && part.errorText ? (
          <div className="mt-2 text-xs text-destructive">{part.errorText}</div>
        ) : null}
      </div>
    );
  }

  if (toolName === "writeEditorContent") {
    const input = part.input as { target?: string; language?: string; content?: string } | undefined;
    const output = part.output as { message?: string; changed?: boolean } | undefined;
    const target = input?.target || "editor";
    const language = input?.language || "text";
    const actionLabel = `${output?.changed === false ? "Checked" : "Updated"} ${target} ${getLanguageLabel(language)}`;

    return (
      <div className="rounded-md border border-border/70 bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wrench className="h-4 w-4" />
            <span>{actionLabel}</span>
          </div>
          <span className="text-xs text-muted-foreground">{stateLabel}</span>
        </div>
        {output?.message ? <div className="mt-2 text-xs text-muted-foreground">{output.message}</div> : null}
        {typeof input?.content === "string" && input.content.length > 0 ? renderCodeBlock(input.content, language) : null}
        {part.state === "output-error" && part.errorText ? (
          <div className="mt-2 text-xs text-destructive">{part.errorText}</div>
        ) : null}
      </div>
    );
  }

  if (toolName === "readEditorContent") {
    const input = part.input as { target?: string; language?: string } | undefined;
    const output = part.output as { target?: string; language?: string; content?: string } | undefined;
    const target = input?.target || output?.target || "editor";
    const language = input?.language || output?.language || "text";

    return (
      <div className="rounded-md border border-border/70 bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wrench className="h-4 w-4" />
            <span>Read {target} {getLanguageLabel(language)}</span>
          </div>
          <span className="text-xs text-muted-foreground">{stateLabel}</span>
        </div>
        {typeof output?.content === "string" && output.content.length > 0 ? renderCodeBlock(output.content, language) : null}
        {typeof output?.content === "string" && output.content.length === 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">Editor is currently empty.</div>
        ) : null}
        {part.state === "output-error" && part.errorText ? (
          <div className="mt-2 text-xs text-destructive">{part.errorText}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/70 bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wrench className="h-4 w-4" />
          <span>{title}</span>
        </div>
        <span className="text-xs text-muted-foreground">{stateLabel}</span>
      </div>
      {part.input ? (
        <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {JSON.stringify(part.input, null, 2)}
        </pre>
      ) : null}
      {part.state === "output-available" && part.output ? (
        <pre className="mt-2 whitespace-pre-wrap break-words text-xs [overflow-wrap:anywhere]">
          {JSON.stringify(part.output, null, 2)}
        </pre>
      ) : null}
      {part.state === "output-error" && part.errorText ? (
        <div className="mt-2 text-xs text-destructive">{part.errorText}</div>
      ) : null}
    </div>
  );
}

export function CreatorAiChatDrawer() {
  const dispatch = useAppDispatch();
  const collaboration = useOptionalCollaboration();
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const level = levels[currentLevel - 1];
  const { config, setModel } = useAIProviderConfig();
  const { open, setOpen, activeLanguage, activeTarget } = useCreatorAiChatStore();
  const [input, setInput] = React.useState("");
  const [modelSearch, setModelSearch] = React.useState("");
  const [models, setModels] = React.useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = React.useState(false);
  const [modelsError, setModelsError] = React.useState<string | null>(null);
  const [persistedStatus, setPersistedStatus] = React.useState<PersistedChatStatus>("idle");
  const [persistedError, setPersistedError] = React.useState<string | null>(null);
  const [hasServerApiKey, setHasServerApiKey] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const messagesRef = React.useRef<UIMessage[]>([]);
  const router = useRouter();
  const isOpenRouterEndpoint = config.apiEndpoint.toLowerCase().includes("openrouter.ai");
  const levelStorageKey = level?.identifier || `level-${currentLevel}`;
  const chatId = `creator-chat-${levelStorageKey}`;
  const initialMessages = React.useMemo(() => loadStoredMessages(levelStorageKey), [levelStorageKey]);
  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api: apiUrl("/api/creator-chat"),
        body: () => ({
          model: config.model,
          apiEndpoint: config.apiEndpoint,
          apiKey: config.apiKey || undefined,
        }),
      }),
    [config.apiEndpoint, config.apiKey, config.model],
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const loadModels = async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const url = isOpenRouterEndpoint
          ? apiUrl("/api/ai/models/read?source=openrouter")
          : apiUrl("/api/ai/models/read");
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.statusText}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setModels(Array.isArray(data.models) ? data.models : []);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setModelsError(fetchError instanceof Error ? fetchError.message : "Failed to fetch models");
        }
      } finally {
        if (!cancelled) {
          setModelsLoading(false);
        }
      }
    };

    loadModels().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpenRouterEndpoint, open]);

  const {
    messages,
    sendMessage,
    addToolOutput,
    status,
    error,
    clearError,
    setMessages,
  } = useChat<any>({
    id: chatId,
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) {
        return;
      }

      const state = store.getState();
      const levelIndex = state.currentLevel.currentLevel - 1;
      const submitToolOutput = (payload: Parameters<typeof addToolOutput>[0]) => {
        queueMicrotask(() => {
          void addToolOutput(payload).catch((toolOutputError) => {
            console.error("Failed to submit tool output:", toolOutputError);
          });
        });
      };

      try {
        switch (toolCall.toolName) {
          case "getLevelContext": {
            const output = getLevelContextSnapshot({
              state,
              collaboration,
              levelIndex,
              activeLanguage,
              activeTarget,
            });
            submitToolOutput({
              tool: "getLevelContext",
              toolCallId: toolCall.toolCallId,
              output,
            });
            break;
          }
          case "readEditorContent": {
            const input = toolCall.input as { target: "template" | "solution"; language: "html" | "css" | "js" };
            const output = readEditorContent({
              state,
              collaboration,
              levelIndex,
              target: input.target,
              language: input.language,
            });
            submitToolOutput({
              tool: "readEditorContent",
              toolCallId: toolCall.toolCallId,
              output,
            });
            break;
          }
          case "writeEditorContent": {
            const input = toolCall.input as {
              target: "template" | "solution";
              language: "html" | "css" | "js";
              content: string;
            };
            const output = writeEditorContent({
              state,
              dispatch,
              collaboration,
              levelIndex,
              target: input.target,
              language: input.language,
              content: input.content,
            });
            submitToolOutput({
              tool: "writeEditorContent",
              toolCallId: toolCall.toolCallId,
              output,
            });
            break;
          }
          default: {
            submitToolOutput({
              state: "output-error",
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              errorText: `Unsupported tool: ${toolCall.toolName}`,
            });
          }
        }
      } catch (toolError) {
        submitToolOutput({
          state: "output-error",
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          errorText: toolError instanceof Error ? toolError.message : "Tool execution failed.",
        });
      }
    },
  });

  const isStreaming = status === "submitted" || status === "streaming";
  const isBackgroundStreaming = persistedStatus === "streaming" && !isStreaming;
  const isBusy = isStreaming || persistedStatus === "streaming";

  React.useEffect(() => {
    messagesRef.current = messages as UIMessage[];
  }, [messages]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;

    const syncPersistedChat = async () => {
      try {
        const response = await fetch(`${apiUrl("/api/creator-chat")}?id=${encodeURIComponent(chatId)}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to load saved chat: ${response.statusText}`);
        }

        const data = (await response.json()) as PersistedChatResponse & { hasConfiguredApiKey?: boolean };
        const persistedChat = data.chat;

        if (cancelled || !persistedChat) {
          return;
        }

        setHasServerApiKey(Boolean(data.hasConfiguredApiKey));
        setPersistedStatus(persistedChat.status);
        setPersistedError(persistedChat.errorMessage ?? null);
        if (!areMessagesEqual(messagesRef.current, persistedChat.messages)) {
          setMessages(persistedChat.messages);
        }

        if (persistedChat.status === "streaming" && intervalId === null) {
          intervalId = window.setInterval(() => {
            void syncPersistedChat();
          }, 1500);
        } else if (persistedChat.status !== "streaming" && intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      } catch (loadError) {
        if (!cancelled) {
          setPersistedError(loadError instanceof Error ? loadError.message : "Failed to load saved chat.");
        }
      }
    };

    void syncPersistedChat();

    return () => {
      cancelled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [chatId, open, setMessages]);

  React.useEffect(() => {
    if (!open || !bottomRef.current) {
      return;
    }
    bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  React.useEffect(() => {
    persistStoredMessages(levelStorageKey, messages as UIMessage[]);
  }, [levelStorageKey, messages]);

  React.useEffect(() => {
    if (!open || !error) {
      return;
    }
    console.error("Creator AI chat error:", error);
  }, [error, open]);

  if (!options.creator) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || chatBlocked) {
      return;
    }

    clearError();
    await sendMessage({ text: trimmed });
    setInput("");
  };

  const availableModels = React.useMemo(() => {
    return models
      .filter((model) => {
        const modality = String(model.architecture?.modality || "").toLowerCase();
        return (
          (modality.includes("text") || modality.includes("chat") || modality.includes("language"))
          && supportsToolUse(model)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [models]);

  const modelOptions = React.useMemo<ComboboxOption[]>(() => {
    return availableModels.map((model) => ({
      value: model.id,
      label: model.name,
      keywords: [model.id, model.name, model.api_provider || model.id.split("/")[0] || ""],
    }));
  }, [availableModels]);

  const modelsById = React.useMemo(
    () => new Map(availableModels.map((model) => [model.id, model])),
    [availableModels],
  );
  const selectedModel = models.find((model) => model.id === config.model) || null;
  const selectedModelSupportsTools = selectedModel ? supportsToolUse(selectedModel) : true;
  const modelSelectionBlocksChat = Boolean(selectedModel && !selectedModelSupportsTools);
  const credentialBlocksChat = !config.apiKey.trim() && !hasServerApiKey;
  const chatBlocked = modelSelectionBlocksChat || credentialBlocksChat;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContentRight className="w-full max-w-[520px]">
        <DrawerHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <DrawerTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                <span>Creator AI Chat</span>
              </DrawerTitle>
              <DrawerDescription className="mt-1">
                {level
                  ? `Level ${currentLevel}: ${level.name}. Active editor: ${activeTarget} ${activeLanguage.toUpperCase()}.`
                  : "No active level selected."}
                {isBusy ? " Responses continue in the background even if you close this drawer or refresh." : ""}
              </DrawerDescription>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    setMessages([]);
                    clearStoredMessages(levelStorageKey);
                    setPersistedStatus("idle");
                    setPersistedError(null);
                    await fetch(`${apiUrl("/api/creator-chat")}?id=${encodeURIComponent(chatId)}`, {
                      method: "DELETE",
                    }).catch(() => {});
                  }}
                >
                  Clear
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-4 p-4">
              {messages.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    Ask for multi-file edits, layout fixes, responsiveness work, or solution/template changes.
                    The assistant can inspect the current level, read editor contents, and write directly to specific editors.
                  </CardContent>
                </Card>
              ) : null}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col gap-2",
                    message.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {message.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    <span>{message.role === "user" ? "You" : "AI"}</span>
                  </div>
                  <div
                    className={cn(
                      "w-full max-w-[92%] rounded-lg border px-3 py-2",
                      message.role === "user" ? "bg-primary text-primary-foreground" : "bg-card",
                    )}
                  >
                    <div className="flex flex-col gap-3">
                      {message.parts.map((part: any, index: number) => {
                        if (part.type === "text") {
                          return (
                            <div key={`${message.id}-text-${index}`}>
                              {renderMarkdownLikeText(part.text)}
                            </div>
                          );
                        }

                        if (typeof part.type === "string" && part.type.startsWith("tool-")) {
                          return <div key={`${message.id}-tool-${index}`}>{renderToolSummary(part)}</div>;
                        }

                        return null;
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {(status === "submitted" || status === "streaming") ? (
                <div className="flex flex-col gap-2 items-start">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Bot className="h-3.5 w-3.5" />
                    <span>AI</span>
                  </div>
                  <div className="rounded-lg border bg-card px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {isBackgroundStreaming ? (
                <div className="flex flex-col gap-2 items-start">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Bot className="h-3.5 w-3.5" />
                    <span>AI</span>
                  </div>
                  <div className="rounded-lg border bg-card px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Finishing previous response in background...</span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-border/60 p-4">
            {error ? (
              <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error.message}
              </div>
            ) : null}

            {!error && persistedError ? (
              <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {persistedError}
              </div>
            ) : null}

            {credentialBlocksChat ? (
              <div className="mb-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                Configure an AI API key in Generation Settings before sending creator chat messages.
              </div>
            ) : null}

            <form className="space-y-3" onSubmit={handleSubmit}>
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (input.trim() && status !== "submitted" && status !== "streaming" && !chatBlocked) {
                      void sendMessage({ text: input.trim() });
                      setInput("");
                      clearError();
                    }
                  }
                }}
                placeholder="Describe what to change. Mention template or solution if you want a specific target."
                rows={5}
                disabled={isBusy || chatBlocked}
              />
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Combobox
                      value={config.model}
                      onValueChange={(value) => {
                        setModel(value);
                        setModelSearch("");
                      }}
                      options={modelOptions}
                      inputValue={modelSearch}
                      onInputChange={setModelSearch}
                      isLoading={modelsLoading}
                      disabled={modelsLoading || modelOptions.length === 0}
                      menuPlacement="top"
                      placeholder={config.model || "Choose model"}
                      searchPlaceholder="Search models..."
                      emptyText={modelsError || "No matching models."}
                      loadingText="Loading models..."
                      className="w-full"
                      contentClassName="w-full"
                      renderValue={(selected) => {
                        const model = selected ? modelsById.get(selected.value) : null;
                        if (!model) {
                          return config.model || "Choose model";
                        }
                        return (
                          <span className="truncate text-sm">
                            {model.id}
                          </span>
                        );
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => router.push("/account/generation")}
                    title="Open generation settings"
                    aria-label="Open generation settings"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {isBusy
                      ? "AI is responding and may call editor tools."
                      : credentialBlocksChat
                        ? "No API key is configured for creator chat. Open Generation Settings and add one."
                      : selectedModel && !selectedModelSupportsTools
                        ? "The selected model does not advertise tool use support. Choose a tool-capable model for creator chat."
                        : "The assistant can inspect and edit HTML, CSS, and JS for template or solution."}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={!input.trim() || isBusy || chatBlocked}>
                      {isBusy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Working
                        </>
                      ) : (
                        <>
                          <SquarePen className="mr-2 h-4 w-4" />
                          Send
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </DrawerContentRight>
    </Drawer>
  );
}
