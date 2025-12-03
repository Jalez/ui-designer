import { NextRequest, NextResponse } from 'next/server';
import { getLevelByIdentifier, updateLevel, deleteLevel } from '@/app/api/_lib/services/levelService';
import debug from 'debug';

const logger = debug('ui_designer:api:levels');

const respondWithError = (error: any, status: number = 400) => {
  logger('%O', error);
  return NextResponse.json({ error: error.message }, { status });
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid ID'));
    }

    const level = await getLevelByIdentifier(id);
    return level
      ? NextResponse.json({
          identifier: level.identifier,
          name: level.name,
          ...level.json,
        })
      : NextResponse.json({ message: 'Level not found' }, { status: 404 });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to fetch level' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid ID'));
    }

    const existingLevel = await getLevelByIdentifier(id);
    if (!existingLevel) {
      return NextResponse.json(
        { message: 'Failed to update: level not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, ...json } = body;

    const updatedLevel = await updateLevel(id, {
      name: name || existingLevel.name,
      json: json ? { ...existingLevel.json, ...json } : existingLevel.json,
    });

    if (!updatedLevel) {
      return NextResponse.json(
        { message: 'Failed to update level' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      identifier: updatedLevel.identifier,
      name: updatedLevel.name,
      ...updatedLevel.json,
    });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to update level' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid ID'));
    }

    const level = await getLevelByIdentifier(id);
    if (!level) {
      return NextResponse.json({ message: 'Level not found' }, { status: 404 });
    }

    const deleted = await deleteLevel(id);
    return deleted
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ message: 'Failed to delete level' }, { status: 500 });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to delete level' },
      { status: 500 }
    );
  }
}

