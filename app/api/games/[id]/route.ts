import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { deleteGame, getGameById, regenerateAccessKey, regenerateShareToken, updateGame } from '@/app/api/_lib/services/gameService';
import type { Game } from '@/app/api/_lib/services/gameService';
import debug from 'debug';

const logger = debug('ui_designer:api:games:id');

const respondWithError = (error: Error, status: number = 400) => NextResponse.json({ error: error.message }, { status });

function buildGamePayload(game: Game | null) {
  if (!game) {
    return null;
  }

  return {
    id: game.id,
    userId: game.user_id,
    mapName: game.map_name,
    title: game.title,
    progressData: game.progress_data,
    isPublic: game.is_public,
    shareToken: game.share_token,
    thumbnailUrl: game.thumbnail_url,
    hideSidebar: game.hide_sidebar,
    accessWindowEnabled: game.access_window_enabled,
    accessStartsAt: game.access_starts_at,
    accessEndsAt: game.access_ends_at,
    accessKeyRequired: game.access_key_required,
    accessKey: game.access_key,
    hasAccessKey: Boolean(game.access_key),
    collaborationMode: game.collaboration_mode,
    isOwner: Boolean(game.is_owner),
    isCollaborator: Boolean(game.is_collaborator),
    canEdit: Boolean(game.can_edit),
    canManageCollaborators: Boolean(game.can_manage_collaborators),
    canRemoveCollaborators: Boolean(game.can_remove_collaborators),
    createdAt: game.created_at,
    updatedAt: game.updated_at,
  };
}

/**
 * GET /api/games/[id]
 * Retrieve a single game if owner or collaborator
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid game ID'));
    }

    const game = await getGameById(id, actorIdentifiers);

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json(buildGamePayload(game));
  } catch (error: unknown) {
    logger('Error %O', error);
    return NextResponse.json({ message: 'Failed to fetch game' }, { status: 500 });
  }
}

/**
 * PATCH /api/games/[id]
 * Update a game (owner or collaborator)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
    const actorId = (session.userId || session.user.email) as string;
    const { id } = await params;
    const body = await request.json();

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid game ID'));
    }

    const existingGame = await getGameById(id, actorIdentifiers);

    if (!existingGame) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (!existingGame.can_edit) {
      return NextResponse.json({ error: 'No edit access for this game' }, { status: 403 });
    }

    let shareToken = body.shareToken;
    if (body.regenerateShareToken) {
      shareToken = await regenerateShareToken(id);
    }

    let accessKey = body.accessKey;
    if (body.regenerateAccessKey) {
      accessKey = await regenerateAccessKey(id);
    }

    const parseDate = (value: unknown): Date | null | undefined => {
      if (value === undefined) return undefined;
      if (value === null || value === '') return null;
      const parsed = new Date(String(value));
      if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid date value');
      }
      return parsed;
    };

    const game = await updateGame(id, {
      title: body.title,
      progressData: body.progressData,
      isPublic: body.isPublic,
      shareToken,
      thumbnailUrl: body.thumbnailUrl,
      hideSidebar: body.hideSidebar,
      accessWindowEnabled: body.accessWindowEnabled,
      accessStartsAt: parseDate(body.accessStartsAt),
      accessEndsAt: parseDate(body.accessEndsAt),
      accessKeyRequired: body.accessKeyRequired,
      accessKey,
      collaborationMode: body.collaborationMode,
    });

    if (!game) {
      return NextResponse.json({ error: 'Failed to update game: update returned no result' }, { status: 500 });
    }

    const gameWithPermissions = await getGameById(id, actorIdentifiers);

    logger('Updated game %s for actor %s', id, actorId);
    return NextResponse.json(buildGamePayload(gameWithPermissions || game));
  } catch (error: unknown) {
    logger('Error %O', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Failed to update game', error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/games/[id]
 * Delete a game (owner only)
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid game ID'));
    }

    const existingGame = await getGameById(id, actorIdentifiers);

    if (!existingGame) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (!existingGame.is_owner) {
      return NextResponse.json({ error: 'Only original creator can delete this game' }, { status: 403 });
    }

    const deleted = await deleteGame(id, existingGame.user_id);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete game' }, { status: 500 });
    }

    logger('Deleted game %s for owner %s', id, existingGame.user_id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger('Error %O', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Failed to delete game', error: message }, { status: 500 });
  }
}
