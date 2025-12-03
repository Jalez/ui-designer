import { NextRequest, NextResponse } from 'next/server';
import { getMapByName, addLevelToMap, removeLevelFromMap, getLevelsForMap } from '@/app/api/_lib/services/mapService';
import { getLevelByIdentifier } from '@/app/api/_lib/services/levelService';
import debug from 'debug';

const logger = debug('ui_designer:api:maps');

const respondWithError = (error: any, status: number = 400) => {
  logger('%O', error);
  return NextResponse.json({ error: error.message }, { status });
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name, id: identifier } = await params;

    if (!name || typeof name !== 'string') {
      return respondWithError(new Error('Invalid map name'));
    }

    if (!identifier || typeof identifier !== 'string') {
      return respondWithError(new Error('Invalid level identifier'));
    }

    const map = await getMapByName(name);
    const level = await getLevelByIdentifier(identifier);

    if (!map) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    if (!level) {
      return NextResponse.json({ message: 'Level not found' }, { status: 404 });
    }

    // Check if level is already in map
    const levels = await getLevelsForMap(name);
    const hasLevel = levels.some((l) => l.identifier === identifier);

    if (hasLevel) {
      return NextResponse.json(
        {
          message:
            'Failed to add level to map: level is already added to the same map',
        },
        { status: 409 }
      );
    }

    await addLevelToMap(name, identifier);

    return NextResponse.json(
      { message: 'Level added to map' },
      { status: 201 }
    );
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to add level to map' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name, id: identifier } = await params;

    if (!name || typeof name !== 'string') {
      return respondWithError(new Error('Invalid map name'));
    }

    if (!identifier || typeof identifier !== 'string') {
      return respondWithError(new Error('Invalid level identifier'));
    }

    const map = await getMapByName(name);
    const level = await getLevelByIdentifier(identifier);

    if (!map) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    if (!level) {
      return NextResponse.json({ message: 'Level not found' }, { status: 404 });
    }

    // Check if level is in map
    const levels = await getLevelsForMap(name);
    const hasLevel = levels.some((l) => l.identifier === identifier);

    if (!hasLevel) {
      return NextResponse.json(
        {
          message:
            'Failed to delete level from map: level was not added to the map',
        },
        { status: 409 }
      );
    }

    const deleted = await removeLevelFromMap(name, identifier);

    return deleted
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ message: 'Failed to remove level from map' }, { status: 500 });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to delete level from map' },
      { status: 500 }
    );
  }
}
