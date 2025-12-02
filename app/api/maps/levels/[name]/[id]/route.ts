import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { nameSchema } from '@/lib/models/validators/map';
import { idSchema as levelIdSchema } from '@/lib/models/validators/level';
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
    const { name: paramName, id: paramId } = await params;
    const { value: name, error: nameError } = nameSchema().validate(
      paramName
    );
    if (nameError) return respondWithError(nameError);

    const { value: identifier, error } = levelIdSchema().validate(paramId);
    if (error) return respondWithError(error);

    const map = await db.Map.findByPk(name);
    const level = await db.Level.findByPk(identifier);

    if (!map) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    if (!level) {
      return NextResponse.json({ message: 'Level not found' }, { status: 404 });
    }

    const hasLevel = await (map as any).hasLevel(level);

    if (hasLevel) {
      return NextResponse.json(
        {
          message:
            'Failed to add level to map: level is already added to the same map',
        },
        { status: 409 }
      );
    }

    await (map as any).addLevel(level);

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
    const { name: paramName, id: paramId } = await params;
    const { value: name, error: nameError } = nameSchema().validate(
      paramName
    );
    if (nameError) return respondWithError(nameError);

    const { value: identifier, error } = levelIdSchema().validate(paramId);
    if (error) return respondWithError(error);

    const map = await db.Map.findByPk(name);
    const level = await db.Level.findByPk(identifier);

    if (!map) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    if (!level) {
      return NextResponse.json({ message: 'Level not found' }, { status: 404 });
    }

    const hasLevel = await (map as any).hasLevel(level);

    if (!hasLevel) {
      return NextResponse.json(
        {
          message:
            'Failed to delete level from map: level was not added to the map',
        },
        { status: 409 }
      );
    }

    await (map as any).removeLevel(level);

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to delete level from map' },
      { status: 500 }
    );
  }
}

