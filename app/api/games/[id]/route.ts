import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getGameById, updateGame, deleteGame, regenerateShareToken } from '@/app/api/_lib/services/gameService';
import debug from 'debug';

const logger = debug('ui_designer:api:games:id');

const respondWithError = (error: Error, status: number = 400) =>
  NextResponse.json({ error: error.message }, { status });

/**
 * GET /api/games/[id]
 * Retrieve a single game
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.userId || session.user.email;
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid game ID'));
    }

    const game = await getGameById(id, userId);

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: game.id,
      userId: game.user_id,
      mapName: game.map_name,
      title: game.title,
      progressData: game.progress_data,
      isPublic: game.is_public,
      shareToken: game.share_token,
      thumbnailUrl: game.thumbnail_url,
      hideSidebar: game.hide_sidebar,
      createdAt: game.created_at,
      updatedAt: game.updated_at,
    });
  } catch (error: unknown) {
    logger('Error %O', error);
    return NextResponse.json(
      { message: 'Failed to fetch game' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/games/[id]
 * Update a game
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.userId || session.user.email;
    const { id } = await params;
    const body = await request.json();

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid game ID'));
    }

    const existingGame = await getGameById(id, userId);

    if (!existingGame) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Handle share token regeneration
    let shareToken = body.shareToken;
    if (body.regenerateShareToken) {
      shareToken = await regenerateShareToken(id, userId);
    }

    const game = await updateGame(id, userId, {
      title: body.title,
      progressData: body.progressData,
      isPublic: body.isPublic,
      shareToken,
      thumbnailUrl: body.thumbnailUrl,
      hideSidebar: body.hideSidebar,
    });

    if (!game) {
      return NextResponse.json(
        { error: 'Failed to update game: update returned no result' },
        { status: 500 }
      );
    }

    logger('Updated game %s for user %s', id, userId);
    return NextResponse.json({
      id: game.id,
      userId: game.user_id,
      mapName: game.map_name,
      title: game.title,
      progressData: game.progress_data,
      isPublic: game.is_public,
      shareToken: game.share_token,
      thumbnailUrl: game.thumbnail_url,
      hideSidebar: game.hide_sidebar,
      createdAt: game.created_at,
      updatedAt: game.updated_at,
    });
  } catch (error: unknown) {
    logger('Error %O', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { message: 'Failed to update game', error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/games/[id]
 * Delete a game
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.userId || session.user.email;
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid game ID'));
    }

    const existingGame = await getGameById(id, userId);

    if (!existingGame) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const deleted = await deleteGame(id, userId);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete game' }, { status: 500 });
    }

    logger('Deleted game %s for user %s', id, userId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger('Error %O', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { message: 'Failed to delete game', error: message },
      { status: 500 }
    );
  }
}
