import { logCollaborationStep } from "./log-collaboration-step.mjs";

export function createRoomStateService({
  roomEditorState,
  roomWriteBuffer,
  roomDivergenceState,
  rooms,
  editorTypes,
  writeBufferQuietMs,
  writeDirtyWarnThreshold,
  fetchCreatorLevels,
  fetchInstanceSnapshotFromDB,
  fetchLevelsForMapName,
  saveProgressToDB,
  createRoomState,
  createStarterLevel,
  mergeTemplateAndProgressLevels,
  ensureGroupStartGate,
  applyStartedGateToLevels,
  getOrCreateYDoc,
  destroyRoomYResources,
  serializeCodeLevels,
}) {
  const roomLastSavedSnapshots = new Map();
  const roomStateLoadPromises = new Map();

  function cloneSerializedLevelsPayload(payload) {
    logCollaborationStep("11.6", "cloneSerializedLevelsPayload", {
      levelsCount: Array.isArray(payload?.levels) ? payload.levels.length : null,
    });
    return JSON.parse(JSON.stringify(payload));
  }

  function hashContent(content) {
    logCollaborationStep("11.4", "hashContent", {
      contentLength: content.length,
    });
    let hash = 0x811c9dc5;
    for (let index = 0; index < content.length; index += 1) {
      hash ^= content.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function summarizePersistedLevels(levels = []) {
    logCollaborationStep("11.5", "summarizePersistedLevels", {
      levelsCount: levels.length,
    });
    return levels.map((level, levelIndex) => {
      const html = typeof level?.code?.html === "string" ? level.code.html : "";
      const css = typeof level?.code?.css === "string" ? level.code.css : "";
      const js = typeof level?.code?.js === "string" ? level.code.js : "";
      return {
        levelIndex,
        name: typeof level?.name === "string" ? level.name : `level-${levelIndex}`,
        htmlLength: html.length,
        htmlHash: hashContent(html),
        cssLength: css.length,
        cssHash: hashContent(css),
        jsLength: js.length,
        jsHash: hashContent(js),
      };
    });
  }

  function hasRoomDivergence(roomId) {
    logCollaborationStep("17.3", "hasRoomDivergence", { roomId });
    for (const key of roomDivergenceState.keys()) {
      if (key.startsWith(`${roomId}:`)) {
        return true;
      }
    }
    return false;
  }

  function hasSevereSnapshotRegression(previousPayload, nextPayload) {
    logCollaborationStep("11.7", "hasSevereSnapshotRegression", {
      previousLevels: Array.isArray(previousPayload?.levels) ? previousPayload.levels.length : null,
      nextLevels: Array.isArray(nextPayload?.levels) ? nextPayload.levels.length : null,
    });
    const previousLevels = Array.isArray(previousPayload?.levels) ? previousPayload.levels : [];
    const nextLevels = Array.isArray(nextPayload?.levels) ? nextPayload.levels : [];
    const levelCount = Math.max(previousLevels.length, nextLevels.length);

    let previousTotal = 0;
    let nextTotal = 0;
    let zeroedEditorCount = 0;

    for (let levelIndex = 0; levelIndex < levelCount; levelIndex += 1) {
      const previousCode = previousLevels[levelIndex]?.code || {};
      const nextCode = nextLevels[levelIndex]?.code || {};
      for (const editorType of editorTypes) {
        const previousContent = typeof previousCode[editorType] === "string" ? previousCode[editorType] : "";
        const nextContent = typeof nextCode[editorType] === "string" ? nextCode[editorType] : "";
        previousTotal += previousContent.length;
        nextTotal += nextContent.length;
        if (previousContent.length > 0 && nextContent.length === 0) {
          zeroedEditorCount += 1;
        }
      }
    }

    if (previousTotal === 0) {
      return false;
    }

    const totalDropRatio = (previousTotal - nextTotal) / previousTotal;
    return zeroedEditorCount > 0 || totalDropRatio >= 0.5;
  }

  function scheduleFlush(roomId) {
    logCollaborationStep("11.3", "scheduleFlush", { roomId });
    const buffer = roomWriteBuffer.get(roomId);
    if (!buffer) {
      return;
    }

    if (buffer.timer) {
      clearTimeout(buffer.timer);
      buffer.timer = null;
    }

    buffer.timer = setTimeout(() => {
      buffer.timer = null;
      flushWriteBuffer(roomId, { reason: "scheduled" });
    }, writeBufferQuietMs);
  }

  async function ensureRoomState(roomId, ctx) {
    logCollaborationStep("8.13", "ensureRoomState", {
      roomId,
      kind: ctx.kind,
    });
    const existing = roomEditorState.get(roomId);
    if (existing) {
      existing.ctx = ctx;
      return existing;
    }

    const pendingLoad = roomStateLoadPromises.get(roomId);
    if (pendingLoad) {
      return pendingLoad;
    }

    const loadPromise = (async () => {
      const latestExisting = roomEditorState.get(roomId);
      if (latestExisting) {
        latestExisting.ctx = ctx;
        return latestExisting;
      }

      if (ctx.kind === "creator") {
        const creatorLevels = await fetchCreatorLevels(ctx);
        // New games have no map/levels yet — seed with a starter level so the
        // creator UI has something to render and edit.
        const effectiveLevels = creatorLevels.length > 0
          ? creatorLevels
          : [createStarterLevel(ctx.mapName)];
        const nextState = createRoomState(ctx, { levels: effectiveLevels }, {
          templateLevels: effectiveLevels,
          mapName: ctx.mapName,
          instanceId: null,
        });
        roomEditorState.set(roomId, nextState);
        getOrCreateYDoc(roomId, nextState);
        return nextState;
      }

      const instanceSnapshot = await fetchInstanceSnapshotFromDB(ctx);
      const progressData =
        instanceSnapshot?.progressData && typeof instanceSnapshot.progressData === "object" && !Array.isArray(instanceSnapshot.progressData)
          ? instanceSnapshot.progressData
          : {};
      const mapName = typeof instanceSnapshot?.mapName === "string" ? instanceSnapshot.mapName : "";
      const templateLevels = mapName ? await fetchLevelsForMapName(mapName) : [];
      const progressLevels = Array.isArray(progressData.levels) ? progressData.levels : [];

      const normalizedLevels =
        templateLevels.length > 0
          ? mergeTemplateAndProgressLevels(templateLevels, progressLevels)
          : progressLevels;

      const finalLevels =
        normalizedLevels.length > 0
          ? normalizedLevels
          : [createStarterLevel(mapName)];

      const nextState = createRoomState(
        ctx,
        {
          ...progressData,
          levels: finalLevels,
        },
        {
          templateLevels,
          mapName,
          instanceId: instanceSnapshot?.instanceId ?? null,
        }
      );
      ensureGroupStartGate(nextState);
      applyStartedGateToLevels(nextState);

      roomEditorState.set(roomId, nextState);
      getOrCreateYDoc(roomId, nextState);

      const serialized = serializeCodeLevels(roomId, nextState);
      const shouldPersistNormalizedLevels =
        JSON.stringify(progressLevels) !== JSON.stringify(finalLevels);
      roomLastSavedSnapshots.set(roomId, cloneSerializedLevelsPayload(serialized));
      if (shouldPersistNormalizedLevels && finalLevels.length > 0) {
        const result = await saveProgressToDB({ ...ctx, instanceId: nextState.instanceId }, serialized);
        if (!result.ok && !result.permanentFailure) {
          markRoomDirty(roomId, ctx);
        }
      }

      return nextState;
    })();

    roomStateLoadPromises.set(roomId, loadPromise);
    try {
      return await loadPromise;
    } finally {
      if (roomStateLoadPromises.get(roomId) === loadPromise) {
        roomStateLoadPromises.delete(roomId);
      }
    }
  }

  function markRoomDirty(roomId, ctx) {
    logCollaborationStep("10.4", "markRoomDirty", {
      roomId,
      gameId: ctx.gameId,
    });
    if (!roomWriteBuffer.has(roomId)) {
      roomWriteBuffer.set(roomId, {
        ctx,
        timer: null,
        lastDirtyAt: 0,
        firstDirtyAt: 0,
        dirtyCount: 0,
        lastWarnedDirtyCount: 0,
      });
    }
    const buffer = roomWriteBuffer.get(roomId);
    const now = Date.now();
    buffer.ctx = ctx;
    buffer.lastDirtyAt = now;
    if (!Number.isFinite(buffer.firstDirtyAt) || buffer.firstDirtyAt === 0) {
      buffer.firstDirtyAt = now;
      buffer.dirtyCount = 0;
      buffer.lastWarnedDirtyCount = 0;
    }
    buffer.dirtyCount += 1;
    const state = roomEditorState.get(roomId);
    if (state && buffer.dirtyCount === 1) {
      const serialized = serializeCodeLevels(roomId, state);
      console.log(
        `[db-save:dirty-start] room=${roomId} gameId=${ctx.gameId} groupId=${ctx.groupId || "none"} ` +
        `instanceId=${state.instanceId || "none"} levels=${JSON.stringify(summarizePersistedLevels(serialized.levels))}`
      );
    } else if (!state && buffer.dirtyCount === 1) {
      console.log(`[db-save:dirty-start] room=${roomId} gameId=${ctx.gameId} groupId=${ctx.groupId || "none"} state=missing`);
    }
    if (buffer.dirtyCount >= writeDirtyWarnThreshold && buffer.dirtyCount - buffer.lastWarnedDirtyCount >= writeDirtyWarnThreshold) {
      buffer.lastWarnedDirtyCount = buffer.dirtyCount;
      console.warn(
        `[db-save:dirty-churn] room=${roomId} gameId=${ctx.gameId} groupId=${ctx.groupId || "none"} ` +
        `dirtyCount=${buffer.dirtyCount} windowMs=${now - buffer.firstDirtyAt}`
      );
    }
    scheduleFlush(roomId);
  }

  async function flushWriteBuffer(roomId, options = {}) {
    logCollaborationStep("11.8", "flushWriteBuffer", {
      roomId,
      reason: typeof options.reason === "string" ? options.reason : "unknown",
      force: options.force === true,
    });
    const buffer = roomWriteBuffer.get(roomId);
    const state = roomEditorState.get(roomId);
    const force = options.force === true;
    const reason = typeof options.reason === "string" ? options.reason : "unknown";

    if (!buffer || !state) {
      if (buffer?.timer) {
        clearTimeout(buffer.timer);
      }
      roomWriteBuffer.delete(roomId);
      return;
    }

    if (!force && Number.isFinite(buffer.lastDirtyAt)) {
      const elapsedSinceDirty = Date.now() - buffer.lastDirtyAt;
      if (elapsedSinceDirty < writeBufferQuietMs) {
        const delayMs = writeBufferQuietMs - elapsedSinceDirty;
        if (buffer.timer) {
          clearTimeout(buffer.timer);
        }
        buffer.timer = setTimeout(() => {
          buffer.timer = null;
          flushWriteBuffer(roomId, { reason: "quiet-window" });
        }, delayMs);
        console.log(
          `[db-save:flush-delay] room=${roomId} gameId=${state.ctx.gameId} groupId=${state.ctx.groupId || "none"} ` +
          `instanceId=${state.instanceId || "none"} reason=${reason} delayMs=${delayMs}`
        );
        return;
      }
    }

    if (buffer.timer) {
      clearTimeout(buffer.timer);
      buffer.timer = null;
    }

    const serialized = serializeCodeLevels(roomId, state);
    let payloadToSave = serialized;
    const previousSavedSnapshot = roomLastSavedSnapshots.get(roomId);
    if (
      previousSavedSnapshot
      && hasRoomDivergence(roomId)
      && hasSevereSnapshotRegression(previousSavedSnapshot, serialized)
    ) {
      payloadToSave = cloneSerializedLevelsPayload(previousSavedSnapshot);
      console.warn(
        `[db-save:guarded-prev] room=${roomId} gameId=${state.ctx.gameId} groupId=${state.ctx.groupId || "none"} ` +
        `instanceId=${state.instanceId || "none"} connectedUsers=${rooms.get(roomId)?.size || 0} ` +
        `current=${JSON.stringify(summarizePersistedLevels(serialized.levels))} ` +
        `fallback=${JSON.stringify(summarizePersistedLevels(payloadToSave.levels))}`
      );
    }
    console.log(
      `[db-save:flush-start] room=${roomId} gameId=${state.ctx.gameId} groupId=${state.ctx.groupId || "none"} ` +
      `instanceId=${state.instanceId || "none"} connectedUsers=${rooms.get(roomId)?.size || 0} reason=${reason} ` +
      `dirtyCount=${buffer.dirtyCount || 0} dirtyWindowMs=${buffer.firstDirtyAt ? Date.now() - buffer.firstDirtyAt : 0} ` +
      `levels=${JSON.stringify(summarizePersistedLevels(payloadToSave.levels))}`
    );
    const result = await saveProgressToDB({ ...state.ctx, instanceId: state.instanceId }, payloadToSave);

    if (result.ok) {
      roomWriteBuffer.delete(roomId);
      roomLastSavedSnapshots.set(roomId, cloneSerializedLevelsPayload(payloadToSave));
      console.log(
        `[db-save:flush-ok] room=${roomId} gameId=${state.ctx.gameId} groupId=${state.ctx.groupId || "none"} ` +
        `instanceId=${state.instanceId || "none"} connectedUsers=${rooms.get(roomId)?.size || 0}`
      );
      if (!rooms.has(roomId)) {
        roomEditorState.delete(roomId);
        destroyRoomYResources(roomId);
      }
    } else if (result.permanentFailure) {
      roomWriteBuffer.delete(roomId);
      console.warn(
        `[db-save:flush-drop] room=${roomId} gameId=${state.ctx.gameId} groupId=${state.ctx.groupId || "none"} ` +
        `instanceId=${state.instanceId || "none"} connectedUsers=${rooms.get(roomId)?.size || 0}`
      );
      if (!rooms.has(roomId)) {
        roomEditorState.delete(roomId);
        destroyRoomYResources(roomId);
      }
      console.warn(`[db-save:drop-room] room=${roomId} gameId=${state.ctx.gameId} reason=not-found`);
    } else {
      console.warn(
        `[db-save:flush-retry] room=${roomId} gameId=${state.ctx.gameId} groupId=${state.ctx.groupId || "none"} ` +
        `instanceId=${state.instanceId || "none"} connectedUsers=${rooms.get(roomId)?.size || 0}`
      );
      scheduleFlush(roomId);
    }
  }

  async function flushAllBuffers() {
    logCollaborationStep("19.11", "flushAllBuffers", {
      bufferCount: roomWriteBuffer.size,
    });
    const promises = [];
    for (const roomId of roomWriteBuffer.keys()) {
      promises.push(flushWriteBuffer(roomId, { force: true, reason: "shutdown" }));
    }
    await Promise.allSettled(promises);
  }

  return {
    ensureRoomState,
    markRoomDirty,
    flushWriteBuffer,
    flushAllBuffers,
  };
}
