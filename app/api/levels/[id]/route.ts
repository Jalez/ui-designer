import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { idSchema, levelSchema } from '@/lib/models/validators/level';
import debug from 'debug';

const logger = debug('ui_designer:api:levels');

const respondWithError = (error: any, status: number = 400) => {
  logger('%O', error);
  return NextResponse.json({ error: error.message }, { status });
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { value: id, error } = idSchema().validate(params.id);
    if (error) return respondWithError(error);

    const level = await db.Level.findByPk(id);
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
  { params }: { params: { id: string } }
) {
  try {
    const { value: id, error: idError } = idSchema().validate(params.id);
    if (idError) return respondWithError(idError);

    const level = await db.Level.findByPk(id);
    if (!level) {
      return NextResponse.json(
        { message: 'Failed to update: level not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { value, error } = levelSchema.tailor('update').validate(body);
    if (error) return respondWithError(error);

    const { name = level.name, ...json } = value;
    await level.update({ name, json: { ...level.json, ...json } });

    return NextResponse.json({
      identifier: level.identifier,
      name: level.name,
      ...level.json,
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
  { params }: { params: { id: string } }
) {
  try {
    const { value: id, error: idError } = idSchema().validate(params.id);
    if (idError) return respondWithError(idError);

    const level = await db.Level.findByPk(id);
    if (!level) {
      return NextResponse.json({ message: 'Level not found' }, { status: 404 });
    }

    await level.destroy();
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to delete level' },
      { status: 500 }
    );
  }
}

