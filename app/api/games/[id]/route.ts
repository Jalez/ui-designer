import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { deleteGame, evaluateGameRouteAccess, getGameById, getGameByIdForGameplay, getGameByIdUnscoped, regenerateAccessKey, regenerateShareToken, updateGame } from '@/app/api/_lib/services/gameService';
import type { Game } from '@/app/api/_lib/services/gameService';
import {
  attachGameAccessCookie,
  clearGameAccessCookie,
  getRawAccessKeyFromRequest,
  resolveAccessKeyForGame,
} from '@/app/api/_lib/services/gameService/accessCookie';
import { resolveSessionAdmin } from '@/app/api/_lib/services/adminService/read';
import { deleteManagedGameThumbnailByUrl, isManagedGameThumbnailUrl } from '@/app/api/_lib/services/gameService/thumbnailStorage';
import { purgeGameDrawboardArtifacts } from "@/app/api/_lib/services/drawboardArtifactCacheService";
import debug from 'debug';

const logger = debug('ui_designer:api:games:id');

const respondWithError = (error: Error, status: number = 400) => NextResponse.json({ error: error.message }, { status });

function getWsAdminUrl(): string {
  const explicit = process.env.WS_SERVER_HTTP_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const configuredWsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  if (configuredWsUrl) {
    return configuredWsUrl.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://").replace(/\/$/, "");
  }

  return "http://localhost:3100";
}

function accessDenied(reason: "not_started" | "expired" | "access_key_required" | "access_key_invalid", game?: Game | null) {
  if (reason === "not_started") {
    return NextResponse.json({
      error: "Game is not open yet",
      reason,
      accessWindowEnabled: game?.access_window_enabled ?? false,
      accessStartsAt: game?.access_starts_at ?? null,
      accessEndsAt: game?.access_ends_at ?? null,
      accessWindowTimezone: game?.access_window_timezone ?? null,
      accessWindows: game?.access_windows ?? [],
    }, { status: 403 });
  }
  if (reason === "expired") {
    return NextResponse.json({ error: "Game access windows have ended", reason }, { status: 403 });
  }
  return NextResponse.json(
    {
      error: reason === "access_key_invalid" ? "Invalid access key" : "Access key required",
      reason,
      requiresAccessKey: true,
      hideSidebar: game?.hide_sidebar ?? false,
    },
    { status: 403 },
  );
}

function shouldEnforceAccess(request: NextRequest): boolean {
  return request.nextUrl.searchParams.get("accessContext") === "game";
}

function buildGamePayload(game: Game | null, actorIsAdmin = false) {
  if (!game) {
    return null;
  }

  return {
    id: game.id,
    userId: game.user_id,
    mapName: game.map_name,
    title: game.title,
    description: game.description,
    progressData: game.progress_data,
    isPublic: game.is_public,
    shareToken: game.share_token,
    thumbnailUrl: game.thumbnail_url,
    hideSidebar: game.hide_sidebar,
    accessWindowEnabled: game.access_window_enabled,
    accessStartsAt: game.access_starts_at,
    accessEndsAt: game.access_ends_at,
    accessWindowTimezone: game.access_window_timezone,
    accessWindows: game.access_windows,
    accessKeyRequired: game.access_key_required,
    accessKey: game.access_key,
    hasAccessKey: Boolean(game.access_key),
    collaborationMode: game.collaboration_mode,
    groupId: game.group_id,
    allowDuplicateUsers: game.allow_duplicate_users,
    drawboardCaptureMode: game.drawboard_capture_mode,
    manualDrawboardCapture: game.manual_drawboard_capture,
    remoteSyncDebounceMs: game.remote_sync_debounce_ms,
    drawboardReloadDebounceMs: game.drawboard_reload_debounce_ms,
    instancePurgeCadence: game.instance_purge_cadence,
    instancePurgeTimezone: game.instance_purge_timezone,
    instancePurgeHour: game.instance_purge_hour,
    instancePurgeMinute: game.instance_purge_minute,
    instancePurgeWeekday: game.instance_purge_weekday,
    instancePurgeDayOfMonth: game.instance_purge_day_of_month,
    instancePurgeLastExecutedAt: game.instance_purge_last_executed_at,
    isOwner: Boolean(game.is_owner),
    isCollaborator: Boolean(game.is_collaborator),
    canEdit: Boolean(game.can_edit) || actorIsAdmin,
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
    const enforceGameplayAccess = shouldEnforceAccess(request);
    if (!session?.user?.email && !enforceGameplayAccess) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const actorIdentifiers = session?.user?.email
      ? [session.userId, session.user.email].filter(Boolean) as string[]
      : [];
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid game ID'));
    }

    const game = enforceGameplayAccess
      ? await getGameByIdForGameplay(id, actorIdentifiers.length ? actorIdentifiers : undefined)
      : await getGameById(id, actorIdentifiers);

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const isActorAdmin = await resolveSessionAdmin(session);

    if (enforceGameplayAccess) {
      const rawAccessKey = getRawAccessKeyFromRequest(request);
      const accessError = evaluateGameRouteAccess(game, resolveAccessKeyForGame(request, game));
      if (accessError) {
        const deniedResponse = accessDenied(accessError, game);
        if (accessError === "access_key_required" || accessError === "access_key_invalid") {
          clearGameAccessCookie(request, deniedResponse, game.id);
        }
        return deniedResponse;
      }

      const response = NextResponse.json(buildGamePayload(game, isActorAdmin));
      attachGameAccessCookie(request, response, game, rawAccessKey);
      return response;
    }

    return NextResponse.json(buildGamePayload(game, isActorAdmin));
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
    const previousThumbnailUrl = existingGame.thumbnail_url;

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
      description: body.description,
      progressData: body.progressData,
      isPublic: body.isPublic,
      shareToken,
      thumbnailUrl: body.thumbnailUrl,
      hideSidebar: body.hideSidebar,
      accessWindowEnabled: body.accessWindowEnabled,
      accessStartsAt: parseDate(body.accessStartsAt),
      accessEndsAt: parseDate(body.accessEndsAt),
      accessWindowTimezone:
        body.accessWindowTimezone === undefined
          ? undefined
          : body.accessWindowTimezone === null || body.accessWindowTimezone === ""
            ? null
            : String(body.accessWindowTimezone),
      accessWindows: body.accessWindows === undefined ? undefined : body.accessWindows,
      accessKeyRequired: body.accessKeyRequired,
      accessKey,
      collaborationMode: body.collaborationMode,
      allowDuplicateUsers: body.allowDuplicateUsers,
      drawboardCaptureMode: body.drawboardCaptureMode,
      manualDrawboardCapture: body.manualDrawboardCapture,
      remoteSyncDebounceMs:
        body.remoteSyncDebounceMs === undefined ? undefined : Number(body.remoteSyncDebounceMs),
      drawboardReloadDebounceMs:
        body.drawboardReloadDebounceMs === undefined ? undefined : Number(body.drawboardReloadDebounceMs),
      instancePurgeCadence:
        body.instancePurgeCadence === undefined
          ? undefined
          : body.instancePurgeCadence === null || body.instancePurgeCadence === ""
            ? null
            : body.instancePurgeCadence,
      instancePurgeTimezone:
        body.instancePurgeTimezone === undefined
          ? undefined
          : body.instancePurgeTimezone === null || body.instancePurgeTimezone === ""
            ? null
            : String(body.instancePurgeTimezone),
      instancePurgeHour:
        body.instancePurgeHour === undefined
          ? undefined
          : body.instancePurgeHour === null || body.instancePurgeHour === ""
            ? null
            : Number(body.instancePurgeHour),
      instancePurgeMinute:
        body.instancePurgeMinute === undefined
          ? undefined
          : body.instancePurgeMinute === null || body.instancePurgeMinute === ""
            ? null
            : Number(body.instancePurgeMinute),
      instancePurgeWeekday:
        body.instancePurgeWeekday === undefined
          ? undefined
          : body.instancePurgeWeekday === null || body.instancePurgeWeekday === ""
            ? null
            : Number(body.instancePurgeWeekday),
      instancePurgeDayOfMonth:
        body.instancePurgeDayOfMonth === undefined
          ? undefined
          : body.instancePurgeDayOfMonth === null || body.instancePurgeDayOfMonth === ""
            ? null
            : Number(body.instancePurgeDayOfMonth),
      instancePurgeLastExecutedAt:
        body.instancePurgeLastExecutedAt === undefined
          ? undefined
          : parseDate(body.instancePurgeLastExecutedAt),
    });

    if (!game) {
      return NextResponse.json({ error: 'Failed to update game: update returned no result' }, { status: 500 });
    }

    const gameWithPermissions = await getGameById(id, actorIdentifiers);
    const nextThumbnailUrl = gameWithPermissions?.thumbnail_url ?? game.thumbnail_url ?? null;
    if (
      previousThumbnailUrl &&
      previousThumbnailUrl !== nextThumbnailUrl &&
      isManagedGameThumbnailUrl(previousThumbnailUrl)
    ) {
      await deleteManagedGameThumbnailByUrl(previousThumbnailUrl).catch((cleanupError) => {
        logger('Failed to clean up stale managed thumbnail for %s: %O', id, cleanupError);
      });
    }

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
    const admin = await resolveSessionAdmin(session);

    if (!id || typeof id !== 'string') {
      return respondWithError(new Error('Invalid game ID'));
    }

    const existingGame = admin
      ? await getGameByIdUnscoped(id)
      : await getGameById(id, actorIdentifiers);

    if (!existingGame) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (!admin && !existingGame.is_owner) {
      return NextResponse.json({ error: 'Only original creator or an admin can delete this game' }, { status: 403 });
    }
    const managedThumbnailToDelete = existingGame.thumbnail_url;

    const deleted = await deleteGame(id);

    if (!deleted.deleted) {
      return NextResponse.json({ error: 'Failed to delete game' }, { status: 500 });
    }
    await purgeGameDrawboardArtifacts(id);
    if (managedThumbnailToDelete && isManagedGameThumbnailUrl(managedThumbnailToDelete)) {
      await deleteManagedGameThumbnailByUrl(managedThumbnailToDelete).catch((cleanupError) => {
        logger('Failed to remove managed thumbnail for deleted game %s: %O', id, cleanupError);
      });
    }

    let wsInvalidation: Record<string, unknown> | null = null;
    try {
      const wsResponse = await fetch(`${getWsAdminUrl()}/admin/reset-game-instances`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ws-service-token": process.env.WS_SERVICE_TOKEN || "",
        },
        body: JSON.stringify({
          gameId: id,
          deletedCount: 1,
          actorUserId: session.userId,
          actorUserEmail: session.user.email,
          actorUserName: session.user.name,
          reason: "game_deleted",
        }),
        cache: "no-store",
      });
      wsInvalidation = await wsResponse.json().catch(() => null);
      if (!wsResponse.ok) {
        logger('Game delete ws invalidation failed for %s: %O', id, wsInvalidation);
      }
    } catch (wsError) {
      logger('Game delete ws invalidation error for %s: %O', id, wsError);
    }

    logger('Deleted game %s by actor %s (admin=%s)', id, session.user.email, admin);
    return NextResponse.json({ success: true, ...deleted, wsInvalidation });
  } catch (error: unknown) {
    logger('Error %O', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Failed to delete game', error: message }, { status: 500 });
  }
}
