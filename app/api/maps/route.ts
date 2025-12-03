import { NextResponse } from 'next/server';
import { getAllMaps, getLevelsForMap } from '@/app/api/_lib/services/mapService';
import debug from 'debug';

const logger = debug('ui_designer:api:maps');

export async function GET() {
  try {
    const maps = await getAllMaps();
    logger('Found %d maps', maps.length);
    
    // Get levels for each map
    const mapsWithLevels = await Promise.all(
      maps.map(async (map) => {
        const levels = await getLevelsForMap(map.name);
        return {
          ...map,
          levels: levels.map((level) => level.identifier),
        };
      })
    );
    
    return NextResponse.json(mapsWithLevels);
  } catch (error: any) {
    logger('Error: %O', error);
    return NextResponse.json(
      { message: 'Failed to fetch maps' },
      { status: 500 }
    );
  }
}

