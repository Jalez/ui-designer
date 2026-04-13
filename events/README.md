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
- `useEventSequenceStore`:
  - event-sequence runtime keyed by `levelId:scenarioId:mode`
  - selected event step per scenario
  - event panel open state
  - auto-run-on-mount state
  - auto-replay mounted-run bookkeeping

`EventsProvider` is now an orchestration wrapper only. It runs auto-replay effects and returns children. Components read `useEventsRuntime()` and `useEventsActions()` directly; those hooks are store-backed and no longer rely on React context providers.

## Store

Core store: `events/core/eventSequenceState.ts`

Primary state:

- `runtimeByKey`
- `selectedStepIdByScenario`
- `panelOpenByScenario`
- `autoReplayOnMountByScenario`
- `autoReplayMountRunKeys`

Primary actions:

- `setRecordingMode`
- `setPendingStep`
- `setStepAccuracy`
- `markStepAccuracyPending`
- `markStepAccuracyTimedOut`
- `bumpDrawingVersion`
- `advanceActiveIndex`
- `startAutoReplay`
- `stopAutoReplay`
- `setAutoReplayProgress`
- `resetRuntimeForKey`
- `setSelectedStep`
- `setPanelOpen`
- `setAutoReplayOnMount`

`updateRuntimeState` and `getRuntimeState` still exist for the few async/effect flows that need imperative access, but named actions should be preferred for normal transitions.

## Module Boundaries

- `events/core/`: store, pure helpers, keying, normalization
- `events/hooks/`: behavior hooks only
- `events/components/`: presentational pieces plus thin orchestration entrypoints

There are no event-state compatibility providers or context-owned event-state wrappers remaining. Store access is direct.

## Main Flows

### Recording

- Creator starts recording from navbar or panel controls
- store recording mode switches to `single` or `continuous`
- drawboard emits interactions
- sequence persists into Redux level data
- single mode auto-stops after the next step is added

### Replay / Timeline

- selected step lives in `useEventSequenceStore`
- `useEventSequencePreview` derives replay depth and trigger scope
- drawboard frame replays the selected prefix
- timeline badges read runtime accuracy and stale state from the store

### Accuracy

- `useStepAccuracyEngine` listens for pixel comparison results
- step accuracy is marked pending, resolved, or timed out in the store
- stale status is derived from `drawingVersion`
- game mode can advance `activeIndex` when the active step meets the threshold

### Auto Replay

- store tracks `autoReplay` progress by runtime key
- `useEventsAutoReplayOrchestration` starts auto-runs on mount when enabled
- `useAutoReplaySequence` iterates step selection and waits for accuracy resolution

## Notes

- Creator preview mode is not owned by `events`; it belongs to `ScenarioContext`.
- `events` consumes preview mode as input when deciding whether replay needs a live iframe.
- Runtime isolation between creator and game mode is preserved through the runtime key.
