import { NextRequest, NextResponse } from 'next/server';
import { getUserSessionByKey, createOrUpdateUserSession, deleteUserSession, deleteExpiredUserSessions } from '@/app/api/_lib/services/userSessionService';
import debug from 'debug';

const logger = debug('ui_designer:api:progression');

const respondWithError = (error: any, status: number = 400) =>
  NextResponse.json({ error: error.message }, { status });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;

    if (!key) {
      return respondWithError(new Error('Key is required'), 400);
    }

    // Decode the URL-encoded key
    const decodedKey = decodeURIComponent(key);

    // Get the most recent non-expired session for this key
    const session = await getUserSessionByKey(decodedKey);

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
    const { key } = await params;
    const body = await request.json();
    const { value, expiresAt } = body;

    if (!key) {
      return respondWithError(new Error('Key is required'), 400);
    }

    // Decode the URL-encoded key
    const decodedKey = decodeURIComponent(key);

    // Clean up expired sessions
    await deleteExpiredUserSessions();

    // Create or update session
    const session = await createOrUpdateUserSession({
      key: decodedKey,
      value: value || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

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
    const { key } = await params;

    if (!key) {
      return respondWithError(new Error('Key is required'), 400);
    }

    // Decode the URL-encoded key
    const decodedKey = decodeURIComponent(key);

    await deleteUserSession(decodedKey);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to delete progression' },
      { status: 500 }
    );
  }
}
