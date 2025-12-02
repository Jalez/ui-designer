import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { nameSchema, levelsSchema } from '@/lib/models/validators/map';
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

    const map = await db.Map.findOne({
      where: { name },
      include: [db.Level],
    });

    return map
      ? NextResponse.json(
          (map as any).Levels.map((level: any) => ({
            identifier: level.identifier,
            name: level.name,
            ...level.json,
          }))
        )
      : NextResponse.json({ message: 'Map not found' }, { status: 404 });
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
    const { name: paramName } = await params;
    const { value: name, error: nameError } = nameSchema().validate(
      paramName
    );
    if (nameError) return respondWithError(nameError);

    const body = await request.json();
    const { value: identifiers, error } = levelsSchema().validate(body);
    if (error) return respondWithError(error);

    const map = await db.Map.findByPk(name);

    if (!map) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    const levelCount = await (map as any).countLevels();

    if (levelCount > 0) {
      return NextResponse.json(
        {
          message: `Failed to set map levels: map already has ${levelCount} levels set.`,
        },
        { status: 409 }
      );
    }

    const levels = await db.Level.findAll({
      where: { identifier: identifiers },
    });

    await Promise.all(
      levels.map((level) => (map as any).addLevel(level))
    );
    await (map as any).reload();

    const updatedLevels = await (map as any).getLevels();
    return NextResponse.json(
      updatedLevels.map((level: any) => level.identifier),
      { status: 201 }
    );
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to set levels to map' },
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
    const { value: identifiers, error } = levelsSchema().validate(body);
    if (error) return respondWithError(error);

    const map = await db.Map.findByPk(name, { include: [db.Level] });

    if (!map) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    const transaction = await db.sequelize.transaction();

    try {
      const levels = await (map as any).getLevels({ transaction });

      const levelsToRemove = levels.filter(
        (level: any) => !identifiers.includes(level.identifier)
      );

      const levelsToKeep = levels
        .filter((level: any) => identifiers.includes(level.identifier))
        .map((level: any) => level.identifier);

      const levelsToAdd = identifiers.filter(
        (identifier: string) => !levelsToKeep.includes(identifier)
      );

      await Promise.all(
        levelsToRemove.map((level: any) => (map as any).removeLevel(level))
      );

      await Promise.all(
        db.Level.findAll({
          where: { identifier: levelsToAdd },
          transaction,
        }).then((levels) => {
          return Promise.all(
            levels.map((level) =>
              (map as any).addLevel(level, { transaction })
            )
          );
        })
      );

      await (map as any).reload({ transaction });
      const updatedLevels = await (map as any).getLevels({ transaction });
      await transaction.commit();

      return NextResponse.json(
        updatedLevels.map((level: any) => level.identifier)
      );
    } catch (error: any) {
      logger('Error %O', error);
      await transaction.rollback();
      return NextResponse.json(
        { message: 'Failed to update map levels' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    logger('Error: %O', error);
    return NextResponse.json(
      { message: 'Failed to update map levels' },
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

    const map = await db.Map.findByPk(name, { include: [db.Level] });

    if (!map) {
      return NextResponse.json({ message: 'Map not found' }, { status: 404 });
    }

    await Promise.all(
      (map as any).Levels.map((level: any) => (map as any).removeLevel(level))
    );
    await (map as any).reload();

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to delete levels from map' },
      { status: 500 }
    );
  }
}

