import { NextRequest, NextResponse } from 'next/server';
import { getAllLevels, createLevel } from '@/app/api/_lib/services/levelService';
import debug from 'debug';

const logger = debug('ui_designer:api:levels');

const respondWithError = (error: any, status: number = 400) => {
  logger('%O', error);
  return NextResponse.json({ error: error.message }, { status });
};

export async function GET(request: NextRequest) {
  try {
    const levels = await getAllLevels();
    logger('Found %d levels', levels.length);
    return NextResponse.json(
      levels.map((level) => ({
        identifier: level.identifier,
        name: level.name,
        ...level.json,
      }))
    );
  } catch (error: any) {
    logger('Error: %O', error);
    return NextResponse.json(
      { message: 'Failed to fetch levels' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ...json } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return respondWithError(new Error('Name is required and must be a non-empty string'));
    }

    const level = await createLevel({ 
      name, 
      json,
    });

    return NextResponse.json(
      {
        identifier: level.identifier,
        name: level.name,
        ...level.json,
      },
      { status: 201 }
    );
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to create level', error: error.message },
      { status: 500 }
    );
  }
}

