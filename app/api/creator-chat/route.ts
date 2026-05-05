import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { resolvePublicSiteUrl } from "@/lib/env/urls";

import { loadCreatorAiChat, updateCreatorAiChat } from "@/app/api/_lib/services/creatorAiChatStore";

export const maxDuration = 30;
export const runtime = "nodejs";

type RequestBody = {
  id?: string;
  messages: UIMessage[];
  model?: string;
  apiEndpoint?: string;
  apiKey?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Creator chat failed.";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("id")?.trim();
  const hasConfiguredApiKey = Boolean(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY);

  if (!chatId) {
    return Response.json({ error: "Missing chat id.", hasConfiguredApiKey }, { status: 400 });
  }

  const record = await loadCreatorAiChat(chatId);

  return Response.json({
    hasConfiguredApiKey,
    chat: record ?? {
      id: chatId,
      status: "idle",
      messages: [],
      updatedAt: new Date(0).toISOString(),
      errorMessage: null,
    },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("id")?.trim();

  if (!chatId) {
    return Response.json({ error: "Missing chat id." }, { status: 400 });
  }

  const record = await updateCreatorAiChat(chatId, {
    status: "idle",
    messages: [],
    errorMessage: null,
  });

  return Response.json({ chat: record });
}

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody;
  const chatId = body.id?.trim();
  const baseURL = body.apiEndpoint || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const resolvedApiKey = body.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  const resolvedModel = body.model || process.env.OPENROUTER_DEFAULT_MODEL || "openai/gpt-4o-mini";

  if (!chatId) {
    return new Response("Missing creator chat id.", { status: 400 });
  }

  if (!resolvedApiKey) {
    return new Response("No API key configured for creator chat.", { status: 400 });
  }

  const isOpenRouter = baseURL.includes("openrouter.ai");
  const siteUrl = resolvePublicSiteUrl();

  const provider = createOpenAI({
    apiKey: resolvedApiKey,
    baseURL,
    headers: isOpenRouter
      ? {
          ...(siteUrl ? { "HTTP-Referer": siteUrl } : {}),
          "X-Title": "UI Designer Creator Chat",
        }
      : undefined,
  });

  await updateCreatorAiChat(chatId, {
    status: "streaming",
    messages: body.messages,
    errorMessage: null,
  });

  const result = streamText({
    model: provider.chat(resolvedModel),
    system: [
      "You are the creator-side coding assistant for a web UI level editor.",
      "You can inspect the current level context and edit specific template or solution editors through tools.",
      "Before making edits, read the current level context unless the user is only asking a narrow follow-up about the immediately previous answer.",
      "Treat the level dimensions as a hard constraint. Use the scenario dimensions from level context, especially primaryDimensions, and make the UI fit cleanly within that frame without overflow unless the user explicitly asks otherwise.",
      "Default to clean separation of concerns: structure in HTML, presentation in CSS, behavior in JS. When code changes span HTML, CSS, and JS, update the necessary files instead of forcing everything into inline styles.",
      "Prefer simple, teachable solutions because most exercises are short. Avoid overwhelming learners with excessive markup, deeply nested structure, large abstractions, or unnecessary effects.",
      "When writing CSS, prefer declaring reusable CSS custom properties near the top for sizes, spacing, colors, radius, and other repeated values.",
      "Use clear class names, modest DOM structure, and straightforward JavaScript. Avoid unnecessary complexity, frameworks, or over-engineered patterns.",
      "This app renders user code inside an already-running preview iframe. Do not rely on document-level bootstrapping patterns such as document.addEventListener('DOMContentLoaded', ...), window.onload, or assumptions that your script runs before the DOM exists.",
      "Instead, write JavaScript that works against the current injected markup immediately. Query the elements you need directly, guard for missing elements, and attach listeners without wrapping everything in DOMContentLoaded.",
      "The preview structure is stable and already mounted when user JS runs. The user markup is rendered inside the drawboard root container, so prefer targeting the actual authored elements rather than document-wide lifecycle hooks.",
      "The HTML editor represents body content only. Do not generate full document wrappers such as <!DOCTYPE html>, <html>, <head>, or <body> unless the user explicitly asks for them.",
      "Write only the HTML that belongs inside the body area of the exercise. Put styles in CSS and behavior in JS rather than embedding full-page document scaffolding in the HTML editor.",
      "Use writeEditorContent to make actual edits. Do not just describe changes if the user asked you to implement them.",
      "After tool calls complete, explain what you changed, which editor targets were updated, and how the solution respects the dimensions and simplicity requirements.",
      "Prefer concise, technically precise explanations.",
    ].join(" "),
    messages: convertToModelMessages(body.messages),
    tools: {
      getLevelContext: tool({
        description:
          "Get the current level context including level name, active editor, template code, solution code, primaryDimensions, scenario dimensions, instructions, and lock state.",
        inputSchema: z.object({
          includeCode: z.boolean().default(true),
        }),
      }),
      readEditorContent: tool({
        description: "Read one specific editor by target and language.",
        inputSchema: z.object({
          target: z.enum(["template", "solution"]),
          language: z.enum(["html", "css", "js"]),
        }),
      }),
      writeEditorContent: tool({
        description:
          "Replace one specific editor's content. Use this when you want to actually apply a change to template or solution HTML/CSS/JS.",
        inputSchema: z.object({
          target: z.enum(["template", "solution"]),
          language: z.enum(["html", "css", "js"]),
          content: z.string().describe("The full replacement content for that editor."),
        }),
      }),
    },
    stopWhen: stepCountIs(10),
  });

  result.consumeStream({
    onError(error) {
      console.error("Creator AI chat consumeStream error:", error);
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: body.messages,
    onFinish({ messages, isAborted }) {
      void updateCreatorAiChat(chatId, {
        status: isAborted ? "error" : "idle",
        messages,
        errorMessage: isAborted ? "The response was interrupted before completion." : null,
      });
    },
    onError(error) {
      const message = getErrorMessage(error);
      void updateCreatorAiChat(chatId, {
        status: "error",
        errorMessage: message,
      });
      return message;
    },
  });
}
