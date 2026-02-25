import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getGamesByUserId, getPublicGames, createGame } from '@/app/api/_lib/services/gameService';
import { getMapByName } from '@/app/api/_lib/services/mapService';
import debug from 'debug';

const logger = debug('ui_designer:api:games');

const respondWithError = (error: Error, status: number = 400) =>
  NextResponse.json({ error: error.message }, { status });

/**
 * GET /api/games
 * - With auth: List user's games
 * - Without auth: List public games
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // If authenticated, return user's games
    if (session?.user?.email) {
      const userId = session.userId || session.user.email;
      const games = await getGamesByUserId(userId);

      logger('Found %d games for user %s', games.length, userId);
      return NextResponse.json(games.map((g) => ({
        id: g.id,
        userId: g.user_id,
        mapName: g.map_name,
        title: g.title,
        progressData: g.progress_data,
        isPublic: g.is_public,
        shareToken: g.share_token,
        thumbnailUrl: g.thumbnail_url,
        hideSidebar: g.hide_sidebar,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      })));
    }

    // Without auth, return public games
    const games = await getPublicGames();

    logger('Found %d public games', games.length);
    return NextResponse.json(games.map((g) => ({
      id: g.id,
      mapName: g.map_name,
      title: g.title,
      thumbnailUrl: g.thumbnail_url,
      shareToken: g.share_token,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    })));
  } catch (error: unknown) {
    logger('Error: %O', error);
    return NextResponse.json(
      { message: 'Failed to fetch games' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/games
 * Create a new game (auth required)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.userId || session.user.email;
    const body = await request.json();

    if (!body.mapName || !body.title) {
      return respondWithError(new Error('mapName and title are required'));
    }

    const map = await getMapByName(body.mapName);
    if (!map) {
      return NextResponse.json(
        { error: 'Map not found' },
        { status: 404 }
      );
    }

    const game = await createGame({
      userId,
      mapName: body.mapName,
      title: body.title,
      progressData: body.progressData || {},
    });

    logger('Created game %s for user %s', game.id, userId);
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
    }, { status: 201 });
  } catch (error: unknown) {
    logger('Error %O', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { message: 'Failed to create game', error: message },
      { status: 500 }
    );
  }
}
