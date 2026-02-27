import { NextRequest, NextResponse } from 'next/server';
import { getGameByShareToken } from '@/app/api/_lib/services/gameService';
import debug from 'debug';

const logger = debug('ui_designer:api:games:play');

/**
 * GET /api/games/play/[token]
 * Load a game by share token (no auth required for public games)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const accessKey = request.nextUrl.searchParams.get("key");

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid share token' }, { status: 400 });
    }

    const lookup = await getGameByShareToken(token, accessKey);
    const game = lookup.game;

    if (!game) {
      if (lookup.error === "access_key_required" || lookup.error === "access_key_invalid") {
        return NextResponse.json(
          {
            error: lookup.error === "access_key_invalid" ? "Invalid access key" : "Access key required",
            requiresAccessKey: true,
          },
          { status: 403 },
        );
      }

      if (lookup.error === "not_started") {
        return NextResponse.json({ error: "Game is not open yet", reason: "not_started" }, { status: 403 });
      }

      if (lookup.error === "expired") {
        return NextResponse.json({ error: "Game access window has ended", reason: "expired" }, { status: 403 });
      }

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
      accessWindowEnabled: game.access_window_enabled,
      accessStartsAt: game.access_starts_at,
      accessEndsAt: game.access_ends_at,
      accessKeyRequired: game.access_key_required,
      collaborationMode: game.collaboration_mode,
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
