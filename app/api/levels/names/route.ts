import { NextResponse } from 'next/server';
import { getAllLevels } from '@/app/api/_lib/services/levelService';
import debug from 'debug';

const logger = debug('ui_designer:api:levels');

export async function GET() {
  try {
    const levels = await getAllLevels();
    return NextResponse.json(
      levels.map((level) => ({
        [level.identifier]: level.name,
      }))
    );
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to fetch level names' },
      { status: 500 }
    );
  }
}

