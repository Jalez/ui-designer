import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import debug from 'debug';

const logger = debug('ui_designer:api:ai');

const models = [
  {
    mode: process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4o-mini',
    name: 'OpenRouter Default',
    description: 'Default model served through OpenRouter (OpenAI-compatible API).',
  },
];

export async function GET() {
  return NextResponse.json(models);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { systemPrompt, prompt, model, apiEndpoint, apiKey } = body;

    const baseURL = apiEndpoint || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const resolvedApiKey = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    const resolvedModel = model || process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4o-mini';

    if (!resolvedApiKey) {
      return NextResponse.json(
        {
          message: 'No API key configured. Set OPENROUTER_API_KEY or provide apiKey from creator settings.',
        },
        { status: 500 },
      );
    }

    const isOpenRouter = baseURL.includes('openrouter.ai');
    const siteUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

    const openai = new OpenAI({
      apiKey: resolvedApiKey,
      baseURL,
      defaultHeaders: isOpenRouter
        ? {
            ...(siteUrl ? { 'HTTP-Referer': siteUrl } : {}),
            'X-Title': 'UI Designer',
          }
        : undefined,
    });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    let chatResponse: OpenAI.Chat.Completions.ChatCompletion;
    try {
      chatResponse = await openai.chat.completions.create({
        model: resolvedModel,
        response_format: { type: 'json_object' },
        messages,
      });
    } catch (firstError: unknown) {
      const errorText = firstError instanceof Error ? firstError.message.toLowerCase() : '';
      const jsonModeUnsupported =
        errorText.includes('response_format') || errorText.includes('json') || errorText.includes('schema');

      if (!jsonModeUnsupported) {
        throw firstError;
      }

      chatResponse = await openai.chat.completions.create({
        model: resolvedModel,
        messages,
      });
    }

    return NextResponse.json(chatResponse.choices[0].message.content);
  } catch (error: unknown) {
    logger('Error: %O', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        message: 'Failed to fetch response from AI provider',
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
