import { NextRequest, NextResponse } from 'next/server';
import { getGameByShareToken } from '@/app/api/_lib/services/gameService';
import debug from 'debug';

const logger = debug('ui_designer:api:games:play');

/**
 * GET /api/games/play/[token]
 * Load a game by share token (no auth required for public games)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid share token' }, { status: 400 });
    }

    const game = await getGameByShareToken(token);

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (!game.is_public) {
      return NextResponse.json({ error: 'Game is not public' }, { status: 403 });
    }

    logger('Loaded game by token %s', token);
    return NextResponse.json({
      id: game.id,
      mapName: game.map_name,
      title: game.title,
      progressData: game.progress_data,
      thumbnailUrl: game.thumbnail_url,
      hideSidebar: game.hide_sidebar,
      shareToken: game.share_token,
      createdAt: game.created_at,
      updatedAt: game.updated_at,
    });
  } catch (error: unknown) {
    logger('Error: %O', error);
    return NextResponse.json(
      { message: 'Failed to load game' },
      { status: 500 }
    );
  }
}
