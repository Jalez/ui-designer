import { NextResponse } from 'next/server';
import db from '@/lib/db';
import debug from 'debug';

const logger = debug('ui_designer:api:levels');

export async function GET() {
  try {
    const levels = await db.Level.findAll({
      attributes: ['identifier', 'name'],
    });
    return NextResponse.json(
      levels.map((level: any) => ({
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

