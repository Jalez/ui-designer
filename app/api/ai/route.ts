import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import debug from 'debug';

const logger = debug('ui_designer:api:ai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const models = [
  {
    mode: 'gpt-3.5-turbo-1106',
    name: 'GPT-3.5 Turbo (JSON)',
    description:
      'The GPT-3.5 Turbo model is a variant of the GPT-3.5 model that is optimized for speed and can generate responses faster than the standard GPT-3.5 model. It is also capable of generating responses in JSON format, which can be useful for integrating the model with other applications and services. The GPT-3.5 Turbo model is well-suited for chatbot applications, question-answering systems, and other natural language processing tasks that require fast response times.',
  },
];

export async function GET() {
  return NextResponse.json(models);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { systemPrompt, prompt } = body;

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-1106',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return NextResponse.json(chatResponse.choices[0].message.content);
  } catch (error: any) {
    logger('Error: %O', error);
    return NextResponse.json(
      {
        message: 'Failed to fetch response from OpenAI',
        error: error.message,
      },
      { status: 500 }
    );
  }
}

