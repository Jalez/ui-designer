import { logCollaborationStep } from "./log-collaboration-step.mjs";

/**
 * COLLABORATION STEP 8.1:
 * Build the room-specific query parameters the websocket server needs when it
 * loads or saves the authoritative game instance through the HTTP API.
 */
function buildInstanceQueryParams(ctx) {
  logCollaborationStep("8.1", "buildInstanceQueryParams", {
    kind: ctx.kind,
    gameId: ctx.gameId ?? null,
  });
  if (ctx.kind !== "instance") {
    return "";
  }
  const params = new URLSearchParams();
  params.set("accessContext", "game");
  if (ctx.groupId) params.set("groupId", ctx.groupId);
  if (ctx.userId) params.set("userId", ctx.userId);
  if (ctx.instanceId) params.set("instanceId", ctx.instanceId);
  return params.toString();
}

/**
 * COLLABORATION STEP 8.2:
 * Create the HTTP bridge used by the websocket server to load persisted room
 * state and save collaborative progress back to the main app backend.
 */
export function createWsApiClient({ apiBaseUrl, wsServiceToken }) {
  logCollaborationStep("8.2", "createWsApiClient", {
    apiBaseUrl,
  });
  /**
   * COLLABORATION STEP 8.3:
   * Load the last persisted group instance snapshot before live collaboration resumes.
   */
  async function fetchInstanceSnapshotFromDB(ctx) {
    logCollaborationStep("8.3", "fetchInstanceSnapshotFromDB", {
      gameId: ctx.gameId,
      groupId: ctx.groupId ?? null,
    });
    const qs = buildInstanceQueryParams(ctx);
    const url = `${apiBaseUrl}/api/games/${ctx.gameId}/instance${qs ? `?${qs}` : ""}`;

    try {
      const response = await fetch(url, {
        headers: {
          "x-ws-service-token": wsServiceToken,
        },
      });
      if (!response.ok) {
        console.error(`[db-fetch:error] status=${response.status} url=${url}`);
        return null;
      }
      const data = await response.json();
      return {
        instanceId: data?.instance?.id ?? null,
        progressData: data?.instance?.progressData ?? null,
        mapName: typeof data?.mapName === "string" ? data.mapName : "",
      };
    } catch (err) {
      console.error(`[db-fetch:error] url=${url}`, err.message);
      return null;
    }
  }

  /**
   * COLLABORATION STEP 11.1:
   * Persist the latest collaborative room snapshot back to the database after the
   * websocket server has buffered and serialized shared edits.
   */
  async function saveProgressToDB(ctx, progressData) {
    logCollaborationStep("11.1", "saveProgressToDB", {
      gameId: ctx.gameId,
      levelsCount: Array.isArray(progressData?.levels) ? progressData.levels.length : null,
    });
    if (ctx.kind !== "instance") {
      return { ok: true, permanentFailure: false };
    }

    const qs = buildInstanceQueryParams(ctx);
    const url = `${apiBaseUrl}/api/games/${ctx.gameId}/instance${qs ? `?${qs}` : ""}`;

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-ws-service-token": wsServiceToken,
        },
        body: JSON.stringify({ progressData }),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`[db-save:error] status=${response.status} url=${url}${errorText ? ` body=${errorText}` : ""}`);
        return {
          ok: false,
          permanentFailure: response.status === 404,
        };
      }
      console.log(`[db-save:ok] gameId=${ctx.gameId}`);
      return { ok: true, permanentFailure: false };
    } catch (err) {
      console.error(`[db-save:error] url=${url}`, err.message);
      return { ok: false, permanentFailure: false };
    }
  }

  /**
   * COLLABORATION STEP 8.4:
   * Load creator template levels when collaboration starts from an unpublished
   * creator room instead of a saved game instance.
   */
  async function fetchCreatorLevels(ctx) {
    logCollaborationStep("8.4", "fetchCreatorLevels", {
      mapName: ctx.mapName,
    });
    const url = `${apiBaseUrl}/api/maps/levels/${encodeURIComponent(ctx.mapName)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[creator-fetch:error] status=${response.status} url=${url}`);
        return [];
      }

      const levels = await response.json();
      return Array.isArray(levels) ? levels : [];
    } catch (err) {
      console.error(`[creator-fetch:error] url=${url}`, err.message);
      return [];
    }
  }

  /**
   * COLLABORATION STEP 8.5:
   * Load template levels for hard resets and normalization of instance state.
   */
  async function fetchLevelsForMapName(mapName) {
    logCollaborationStep("8.5", "fetchLevelsForMapName", {
      mapName,
    });
    const url = `${apiBaseUrl}/api/maps/levels/${encodeURIComponent(mapName)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[map-fetch:error] status=${response.status} url=${url}`);
        return [];
      }

      const levels = await response.json();
      return Array.isArray(levels) ? levels : [];
    } catch (err) {
      console.error(`[map-fetch:error] url=${url}`, err.message);
      return [];
    }
  }

  return {
    fetchInstanceSnapshotFromDB,
    saveProgressToDB,
    fetchCreatorLevels,
    fetchLevelsForMapName,
  };
}
