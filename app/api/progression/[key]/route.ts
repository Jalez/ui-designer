import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import debug from 'debug';

const logger = debug('ui_designer:api:progression');

const respondWithError = (error: any, status: number = 400) =>
  NextResponse.json({ error: error.message }, { status });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // Ensure database connection is established
    await db.sequelize.authenticate();
    
    const { key } = await params;

    if (!key) {
      return respondWithError(new Error('Key is required'), 400);
    }

    // Decode the URL-encoded key
    const decodedKey = decodeURIComponent(key);

    // Get the most recent non-expired session for this key
    const { Op } = db.Sequelize;
    const session = await db.UserSession.findOne({
      where: {
        key: decodedKey,
        [Op.or]: [
          { expiresAt: null },
          { expiresAt: { [Op.gt]: new Date() } },
        ],
      },
      order: [['updatedAt', 'DESC']],
    });

    if (!session) {
      return NextResponse.json({ value: null });
    }

    return NextResponse.json({ value: session.value });
  } catch (error: any) {
    logger('Error %O', error);
    console.error('Progression GET error:', error);
    return NextResponse.json(
      { message: 'Failed to fetch progression', error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // Ensure database connection is established
    await db.sequelize.authenticate();
    
    const { key } = await params;
    const body = await request.json();
    const { value, expiresAt } = body;

    if (!key) {
      return respondWithError(new Error('Key is required'), 400);
    }

    // Decode the URL-encoded key
    const decodedKey = decodeURIComponent(key);

    // Clean up expired sessions for this key
    const { Op } = db.Sequelize;
    await db.UserSession.destroy({
      where: {
        key: decodedKey,
        expiresAt: {
          [Op.lt]: new Date(),
        },
      },
    });

    // Find existing session or create new one
    const [session, created] = await db.UserSession.findOrCreate({
      where: { key: decodedKey },
      defaults: {
        key: decodedKey,
        value: value || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    if (!created) {
      // Update existing session
      session.value = value || null;
      if (expiresAt) {
        session.expiresAt = new Date(expiresAt);
      }
      await session.save();
    }

    return NextResponse.json({ success: true, value: session.value });
  } catch (error: any) {
    logger('Error %O', error);
    console.error('Progression POST error:', error);
    return NextResponse.json(
      { message: 'Failed to save progression', error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    // Ensure database connection is established
    await db.sequelize.authenticate();
    
    const { key } = await params;

    if (!key) {
      return respondWithError(new Error('Key is required'), 400);
    }

    // Decode the URL-encoded key
    const decodedKey = decodeURIComponent(key);

    await db.UserSession.destroy({
      where: { key: decodedKey },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to delete progression' },
      { status: 500 }
    );
  }
}

