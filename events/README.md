# Events Module

The `events/` module owns event-sequence runtime behavior: recording, replay, timeline state, auto-replay, and step accuracy/scoring orchestration.

## Architecture

State is split by responsibility:

- Redux:
  - persisted level content
  - `level.eventSequence.byScenarioId`
  - drawing / solution / diff URLs
- `ScenarioContext`:
  - selected scenario
  - creator preview mode for artboards
- **`useEventSequenceRunStore`** ([`events/core/eventSequenceRunStore.ts`](core/eventSequenceRunStore.ts)):
  - **Single field:** `isRunning` — whether an event-sequence replay batch is in progress (global for the session).
- **`useEventSequenceCaptureStore`** ([`events/core/eventSequenceCaptureStore.ts`](core/eventSequenceCaptureStore.ts)):
  - **Per `runtimeKey`:** `drawingVersion`, `stepAccuraciesByStepId`, `lastReplayCompletedDrawingVersion` (staleness vs last completed replay).
  - Pixel scores and draw-generation epoch live here.
- **`useEventSequenceRecordingStore`** ([`events/core/eventSequenceRecordingStore.ts`](core/eventSequenceRecordingStore.ts)):
  - **Per `runtimeKey`:** `recordingMode` (`idle` | `single` | `continuous`).
- **`useEventSequenceGameProgressStore`** ([`events/core/eventSequenceGameProgressStore.ts`](core/eventSequenceGameProgressStore.ts)):
  - **Per `runtimeKey`:** `activeIndex`, `pendingStepId` (game route ladder / verified interaction gate).
- **`useEventSequenceReplayBatchStore`** ([`events/core/eventSequenceReplayBatchStore.ts`](core/eventSequenceReplayBatchStore.ts)):
  - **Per `runtimeKey`:** `replayBatchSession` (`runId`, restore step, batch step progress) — correlates iframe batch postMessages.
- **`useEventSequenceReplayUiStore`** ([`events/core/eventSequenceReplayUiStore.ts`](core/eventSequenceReplayUiStore.ts)):
  - **Per `runtimeKey`:** `replayJourney` + `replayDiagnostics` — iframe-driven header/timeline replay feedback (no batch `runId` logic).
- **`useEventSequenceTimelineUiStore`** ([`events/core/eventSequenceTimelineUiStore.ts`](core/eventSequenceTimelineUiStore.ts)):
  - **Per scenario UI key** (`levelId:scenarioId`): `selectedStepIdByScenario`, `panelOpenByScenario`.
- **`useEventSequenceAutoRunPrefsStore`** ([`events/core/eventSequenceAutoRunPrefsStore.ts`](core/eventSequenceAutoRunPrefsStore.ts)):
  - Mount dedupe keys, `queuedAutoReplayRequest`, `autoReplayOnMountByScenario` + `localStorage` persistence.

### Facades ([`events/core/eventSequenceFacades.ts`](core/eventSequenceFacades.ts))

Not a store — only sequences writes across stores for replay lifecycle and reset:

- **`beginReplayBatch` / `endReplayBatch`** — batch session + journey start/end + `isRunning`.
- **`markReplayJourneyCompleted`** — capture replay-accuracy baseline + journey completed slice.
- **`resetRuntimeState` / `resetRuntimeForKey`** — clears capture + recording + game + batch + replay UI for one `runtimeKey` (and clears `isRunning` if a batch was active).
- **`markStepAccuracyTimedOut`** — capture timeout row + clear matching `pendingStepId` on the game store.

[`eventSequenceState.ts`](core/eventSequenceState.ts) re-exports stores, facades, merged runtime helpers (`getMergedSequenceRuntimeState`, `useMergedSequenceRuntimeState`), `selectRuntimeState` (compat), `waitForStepAccuracy`, `getStepAccuracyValue`, `isStepStale`, and shared types/constants.

`EventsProvider` is an orchestration wrapper only. It runs auto-replay effects and returns children. Components read `useEventsRuntime()` and `useEventsActions()` directly; those hooks are store-backed.

## Store layout (summary)

| Store | One-line responsibility |
|-------|-------------------------|
| `eventSequenceRunStore` | Is a replay run in flight? (`isRunning` only.) |
| `eventSequenceCaptureStore` | Draw generation epoch vs measured per-step scores and staleness inputs. |
| `eventSequenceRecordingStore` | Creator recording mode per `runtimeKey`. |
| `eventSequenceGameProgressStore` | Player ladder: `activeIndex` + `pendingStepId` per `runtimeKey`. |
| `eventSequenceReplayBatchStore` | Batch replay correlation for the drawboard iframe (`runId`, progress, restore step). |
| `eventSequenceReplayUiStore` | Replay feedback mirror: journey + diagnostics from iframe events. |
| `eventSequenceTimelineUiStore` | Timeline chrome: selected step + panel open per scenario. |
| `eventSequenceAutoRunPrefsStore` | Auto-run policy + queue + mount dedupe + persistence. |

## Module Boundaries

- `events/core/`: stores, pure helpers, keying, normalization (`eventSequenceMetricsTypes.ts` for shared accuracy row type; `eventSequenceReplayTypes.ts` for shared replay/recording types)
- `events/hooks/`: behavior hooks only
- `events/components/`: presentational pieces plus thin orchestration entrypoints

## Main Flows

### Recording

- Creator starts recording from navbar or panel controls
- `useEventSequenceRecordingStore` recording mode switches to `single` or `continuous`
- drawboard emits interactions
- sequence persists into Redux level data
- single mode auto-stops after the next step is added

### Replay / Timeline

- selected step lives in `useEventSequenceTimelineUiStore`
- `useEventSequencePreview` derives replay depth and trigger scope
- drawboard frame replays the selected prefix
- timeline badges read accuracy/stale from **capture store** via `getStepAccuracyValue` / `isStepStale(runtimeKey, …)`
- merged per-runtime view for hooks: `useMergedSequenceRuntimeState(runtimeKey)` (recording + game + batch + replay UI)

### Accuracy

- `useStepAccuracyEngine` listens for pixel comparison results
- writes scores through `useEventSequenceCaptureStore`
- game route advances via `useEventSequenceGameProgressStore` `tryAdvanceAfterVerifiedAccuracy` when not `isRunning` and the active step meets the threshold

### Auto Replay

- `useEventsAutoReplayOrchestration` starts auto-runs on mount when enabled
- `useAutoReplaySequence` mirrors batch + run flags

## Notes

- Creator preview mode is not owned by `events`; it belongs to `ScenarioContext`.
- `events` consumes preview mode as input when deciding whether replay needs a live iframe.
- Runtime isolation between creator and game routes is preserved through the runtime key.
