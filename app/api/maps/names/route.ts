import { NextResponse } from 'next/server';
import db from '@/lib/db';
import debug from 'debug';

const logger = debug('ui_designer:api:maps');

export async function GET() {
  try {
    const maps = await db.Map.findAll({
      attributes: ['name'],
    });
    return NextResponse.json(maps.map((map: any) => map.name));
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to fetch map names' },
      { status: 500 }
    );
  }
}

