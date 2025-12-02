import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { nameSchema, mapSchema } from '@/lib/models/validators/map';
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
    const { name: paramName } = await params;
    const { value: name, error } = nameSchema().validate(paramName);
    if (error) return respondWithError(error);

    const map = await db.Map.findByPk(name, { include: [db.Level] });

    if (!map) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    const mapJson = (map as any).toJSON();
    delete mapJson.Levels;
    mapJson.levels = (map as any).Levels.map((level: any) => level.identifier);

    return NextResponse.json(mapJson);
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
    const { name: paramName } = await params;
    const { value: name, error: nameError } = nameSchema().validate(
      paramName
    );
    if (nameError) return respondWithError(nameError);

    const body = await request.json();
    const { value: data, error } = mapSchema.tailor('create').validate(body);
    if (error) return respondWithError(error);

    let map = await db.Map.findByPk(name);

    if (map) {
      return NextResponse.json(
        {
          message:
            'Failed to create map: a map with the same name already exists',
        },
        { status: 409 }
      );
    }

    map = await db.Map.create({ name, ...data });
    return NextResponse.json({ ...(map as any).toJSON(), levels: [] }, {
      status: 201,
    });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to create map' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name: paramName } = await params;
    const { value: name, error: nameError } = nameSchema().validate(
      paramName
    );
    if (nameError) return respondWithError(nameError);

    const body = await request.json();
    const { value: data, error } = mapSchema.tailor('update').validate(body);
    if (error) return respondWithError(error);

    const map = await db.Map.findByPk(name, { include: [db.Level] });

    if (!map) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    await (map as any).update({ ...data });

    const mapJson = (map as any).toJSON();
    delete mapJson.Levels;
    mapJson.levels = (map as any).Levels.map((level: any) => level.identifier);

    return NextResponse.json(mapJson);
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
    const { name: paramName } = await params;
    const { value: name, error } = nameSchema().validate(paramName);
    if (error) return respondWithError(error);

    const map = await db.Map.findByPk(name);

    if (!map) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    await (map as any).destroy();
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to delete map' },
      { status: 500 }
    );
  }
}

