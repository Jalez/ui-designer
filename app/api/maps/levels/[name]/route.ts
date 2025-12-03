import { NextRequest, NextResponse } from 'next/server';
import { getMapByName, getLevelsForMap, addLevelToMap } from '@/app/api/_lib/services/mapService';
import { getAllLevels } from '@/app/api/_lib/services/levelService';
import debug from 'debug';

const logger = debug('ui_designer:api:maps');

const respondWithError = (error: any, status: number = 400) => {
  logger('%O', error);
  return NextResponse.json({ error: error.message }, { status });
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    if (!name || typeof name !== 'string') {
      return respondWithError(new Error('Invalid name'));
    }

    const map = await getMapByName(name);

    if (!map) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    const levels = await getLevelsForMap(name);

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
      { message: 'Failed to fetch levels for map' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    if (!name || typeof name !== 'string') {
      return respondWithError(new Error('Invalid name'));
    }

    const map = await getMapByName(name);

    if (!map) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    const body = await request.json();
    
    if (!body.levels || !Array.isArray(body.levels)) {
      return respondWithError(new Error('levels must be an array'));
    }

    // Get all levels to validate identifiers
    const allLevels = await getAllLevels();
    const validIdentifiers = new Set(allLevels.map((l) => l.identifier));

    // Validate all level identifiers
    for (const levelId of body.levels) {
      if (!validIdentifiers.has(levelId)) {
        return respondWithError(new Error(`Level with identifier ${levelId} not found`));
      }
    }

    // Add all levels to the map
    for (const levelId of body.levels) {
      await addLevelToMap(name, levelId);
    }

    return NextResponse.json({ message: 'Levels added successfully' });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to add levels to map' },
      { status: 500 }
    );
  }
}
