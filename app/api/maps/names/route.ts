import { NextResponse } from 'next/server';
import { getAllMapNames } from '@/app/api/_lib/services/mapService';
import debug from 'debug';

const logger = debug('ui_designer:api:maps');

export async function GET() {
  try {
    const mapNames = await getAllMapNames();
    return NextResponse.json(mapNames);
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to fetch map names' },
      { status: 500 }
    );
  }
}

