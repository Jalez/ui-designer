import { NextRequest, NextResponse } from 'next/server';
import { getMapByName, getLevelsForMap, createMap, updateMap, deleteMap } from '@/app/api/_lib/services/mapService';
import { requireAuthenticated, requireMapEditAccess } from '@/app/api/_lib/middleware/contentAccess';
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

    return NextResponse.json({
      ...map,
      levels: levels.map((level) => level.identifier),
    });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to fetch map' },
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

    // A map that does not exist yet has no owner, so authentication is the check here.
    const denied = await requireAuthenticated();
    if (denied) {
      return denied;
    }

    const body = await request.json();

    const existingMap = await getMapByName(name);

    if (existingMap) {
      return NextResponse.json(
        {
          message:
            'Failed to create map: a map with the same name already exists',
        },
        { status: 409 }
      );
    }

    const map = await createMap({
      name,
      random: body.random,
      can_use_ai: body.can_use_ai,
    });
    
    return NextResponse.json({ ...map, levels: [] }, {
      status: 201,
    });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to create map', error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    if (!name || typeof name !== 'string') {
      return respondWithError(new Error('Invalid name'));
    }

    const denied = await requireMapEditAccess(name);
    if (denied) {
      return denied;
    }

    const body = await request.json();

    const existingMap = await getMapByName(name);

    if (!existingMap) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    const updatedMap = await updateMap(name, {
      random: body.random,
      can_use_ai: body.can_use_ai,
    });

    if (!updatedMap) {
      return NextResponse.json(
        { message: 'Failed to update map' },
        { status: 500 }
      );
    }

    const levels = await getLevelsForMap(name);

    return NextResponse.json({
      ...updatedMap,
      levels: levels.map((level) => level.identifier),
    });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to update map' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    if (!name || typeof name !== 'string') {
      return respondWithError(new Error('Invalid name'));
    }

    const denied = await requireMapEditAccess(name);
    if (denied) {
      return denied;
    }

    const map = await getMapByName(name);

    if (!map) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    const deleted = await deleteMap(name);
    return deleted
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ message: 'Failed to delete map' }, { status: 500 });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to delete map' },
      { status: 500 }
    );
  }
}
