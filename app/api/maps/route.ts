import { NextResponse } from 'next/server';
import db from '@/lib/db';
import debug from 'debug';

const logger = debug('ui_designer:api:maps');

export async function GET() {
  try {
    const maps = await db.Map.findAll({ include: [db.Level] });
    logger('Found %d maps', maps.length);
    return NextResponse.json(
      maps.map((map: any) => {
        const json = map.toJSON();
        delete json.Levels;
        json.levels = map.Levels.map((level: any) => level.identifier);
        return json;
      })
    );
  } catch (error: any) {
    logger('Error: %O', error);
    return NextResponse.json(
      { message: 'Failed to fetch maps' },
      { status: 500 }
    );
  }
}

