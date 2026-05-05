# Events Architecture Audit (De-bloat Plan)

## Why this exists
This document explains, in simple terms, what the Events files do today and whether each file should stay in the future.

This pass is scoped to:
- events/*
- Direct consumers in components/ArtBoards that use Events modules

This pass is not adding a global cross-level accuracy cache.

## Target architecture
Target ownership model:
- GameContext: game-wide state and totals
- LevelContext: selected level facts and level aggregates
- ScenarioContext: selected scenario, scenario runtime, scenario event persistence API
- EventsContext: plural, per-step maps for the selected scenario
- EventContext: singular, currently focused event snapshot

Data flow target:
- GameContext -> LevelContext -> ScenarioContext -> EventsContext -> EventContext -> UI

## Decision labels
- Keep: file is needed and aligned
- Refactor: keep behavior, simplify structure
- Merge: combine with another file to reduce overlap
- Remove: safe to delete after migration

Priority:
- P0: safety-critical runtime behavior
- P1: meaningful simplification
- P2: optional cleanup

---

## A) Events components

| File | Simple purpose | Decision | Priority | Notes |
|---|---|---|---|---|
| [events/components/EventContext.tsx](../events/components/EventContext.tsx) | Gives one current event snapshot to UI. | Keep | P0 | Good singular facade after recent split. |
| [events/components/EventsContext.tsx](../events/components/EventsContext.tsx) | Holds step-by-step maps (urls, diff, accuracy, triggers). | Keep | P0 | Core plural state for selected scenario. |
| [events/components/ScenarioDrawingContext.tsx](../events/components/ScenarioDrawingContext.tsx) | Shares drawing/model orchestration outputs to subtree. | Keep | P1 | Useful adapter boundary. |
| [events/components/EventsBoundScenarioDrawing.tsx](../events/components/EventsBoundScenarioDrawing.tsx) | Main drawing orchestrator: hooks, replay, capture, compare, dispatch. | Refactor | P0 | Necessary but too broad. Split internal concerns into smaller hooks. |
| [events/components/EventsBoundScenarioModel.tsx](../events/components/EventsBoundScenarioModel.tsx) | Model/solution orchestrator and solution capture flow. | Refactor | P1 | Large overlap with drawing orchestrator patterns. |
| [events/components/EventSequencePanel.tsx](../events/components/EventSequencePanel.tsx) | Timeline strip container and replay diagnostic UI. | Refactor | P1 | Contains derivation + toast behavior that can move to hooks. |
| [events/components/EventSequenceHeader.tsx](../events/components/EventSequenceHeader.tsx) | Replay progress header UI. | Merge | P2 | Could be merged into panel if kept tiny. |
| [events/components/EventSequenceStepItem.tsx](../events/components/EventSequenceStepItem.tsx) | One step button with status and accuracy visuals. | Keep | P1 | Good unit; optional small refactor of status derivation. |
| [events/components/StepCircle.tsx](../events/components/StepCircle.tsx) | Pure presentational badge for a step. | Keep | P2 | Clean visual component. |
| [events/components/ReplayDiagnosticMarker.tsx](../events/components/ReplayDiagnosticMarker.tsx) | Shows replay-only hidden diagnostics between visible steps. | Keep | P1 | Specialized and useful. |
| [events/components/ScenarioEventRunButtons.tsx](../events/components/ScenarioEventRunButtons.tsx) | Start/stop replay controls for scenario events. | Keep | P0 | Core interaction surface. |

Important must-keep behavior in components:
- Step creation/editing workflows must stay fully supported by timeline and scenario controls.
- Run/replay and stale-to-fresh accuracy update UX must stay unchanged during refactors.

---

## B) Events hooks

| File | Simple purpose | Decision | Priority | Notes |
|---|---|---|---|---|
| [events/hooks/useStepScopedMapState.ts](../events/hooks/useStepScopedMapState.ts) | Reusable per-step map state helper with reset/fallback. | Keep | P0 | Strong utility; low risk. |
| [events/hooks/useEventSequencePreview.ts](../events/hooks/useEventSequencePreview.ts) | Decides replay sequence and preview mode behavior. | Keep | P1 | Mostly pure derivation. |
| [events/hooks/useScenarioDrawingPixelsSerial.ts](../events/hooks/useScenarioDrawingPixelsSerial.ts) | Subscribes to drawing pixel serial changes. | Keep | P1 | Good focused adapter hook. |
| [events/hooks/useStepPreviewRenderer.ts](../events/hooks/useStepPreviewRenderer.ts) | Produces step preview renders and dispatches them. | Keep | P1 | Useful isolated responsibility. |
| [events/hooks/useScenarioEventBridge.ts](../events/hooks/useScenarioEventBridge.ts) | Bridges scenario event reads/writes to redux/zustand. | Refactor | P1 | Keep bridge internals in ScenarioContext boundary only. |
| [events/hooks/useScenarioRuntimeState.ts](../events/hooks/useScenarioRuntimeState.ts) | Big scenario runtime derivation + action handlers. | Refactor | P0 | Split read model from action handlers. |
| [events/hooks/useSequenceRuntimeLifecycle.ts](../events/hooks/useSequenceRuntimeLifecycle.ts) | Handles runtime lifecycle resets and interaction side effects. | Refactor | P1 | Multiple concerns in one hook. |
| [events/hooks/useStepCompareOrchestration.ts](../events/hooks/useStepCompareOrchestration.ts) | Compare loop, timing, and progression gating. | Refactor | P0 | Behavior-sensitive. Keep logic, reduce coupling. |

| [events/hooks/useAutoReplaySequence.ts](../events/hooks/useAutoReplaySequence.ts) | Auto cycles through sequence replay steps. | Merge | P1 | Candidate to fold into one replay orchestration path. |
| [events/hooks/useEventsAutoReplayOrchestration.ts](../events/hooks/useEventsAutoReplayOrchestration.ts) | Mount-time auto replay trigger logic. | Merge | P1 | Can merge into a single replay trigger service/facade. |
| [events/hooks/useScenarioArtifacts.ts](../events/hooks/useScenarioArtifacts.ts) | Resolves scenario artifacts and hydration logic. | Refactor | P1 | Split URL resolution vs hydration/cache concerns. |

---

## C) Events core

### C1) Stores and orchestration

| File | Simple purpose | Decision | Priority | Notes |
|---|---|---|---|---|
| [events/core/eventSequenceCaptureStore.ts](../events/core/eventSequenceCaptureStore.ts) | Source of step accuracy and staleness/version tracking. | Keep | P0 | Critical source of truth. |
| [events/core/eventSequenceGameProgressStore.ts](../events/core/eventSequenceGameProgressStore.ts) | Tracks active index and pending step progression. | Keep | P0 | Critical for game progression rules. |
| [events/core/eventSequenceRecordingStore.ts](../events/core/eventSequenceRecordingStore.ts) | Recording mode per runtime key. | Keep | P1 | Needed for creator mode behavior. |
| [events/core/eventSequenceTimelineUiStore.ts](../events/core/eventSequenceTimelineUiStore.ts) | Selected timeline step and panel open state. | Keep | P1 | UI state ownership is clear. |
| [events/core/eventSequenceAutoRunPrefsStore.ts](../events/core/eventSequenceAutoRunPrefsStore.ts) | Auto-run mount preference and queued request state. | Refactor | P1 | Keep feature, simplify queue handling. |
| [events/core/eventSequenceReplayBatchStore.ts](../events/core/eventSequenceReplayBatchStore.ts) | Batch session state by runtime key. | Merge | P1 | Candidate to fold into one replay store. |
| [events/core/eventSequenceReplayUiStore.ts](../events/core/eventSequenceReplayUiStore.ts) | Replay journey + diagnostics state. | Merge | P1 | Candidate to fold into one replay store. |
| [events/core/eventSequenceRunStore.ts](../events/core/eventSequenceRunStore.ts) | Global replay running flag. | Merge | P1 | Likely merge into replay store. |
| [events/core/sequenceReplayStore.ts](../events/core/sequenceReplayStore.ts) | Replay-centric store for run batch/journey/diagnostics. | Refactor | P0 | Make this the single replay store (or replace with unified one). |
| [events/core/eventSequenceFacades.ts](../events/core/eventSequenceFacades.ts) | Multi-store orchestration entry points. | Keep | P0 | Keep as orchestration API boundary. |
| [events/core/sequenceLifecycle.ts](../events/core/sequenceLifecycle.ts) | Lifecycle helpers overlapping facade behavior. | Merge | P1 | Fold into facades to reduce duplicate lifecycle paths. |
| [events/core/eventSequenceMergedRuntime.ts](../events/core/eventSequenceMergedRuntime.ts) | Merges runtime slices into one view model. | Keep | P1 | Useful integration adapter. |
| [events/core/eventSequenceState.ts](../events/core/eventSequenceState.ts) | Re-exports and combined selectors/helpers. | Keep | P1 | Public integration surface. |

### C2) Accuracy, diagnostics, assets, helpers

| File | Simple purpose | Decision | Priority | Notes |
|---|---|---|---|---|
| [events/core/aggregateEventSequenceAccuracy.ts](../events/core/aggregateEventSequenceAccuracy.ts) | Scenario-level accuracy aggregate and stale handling. | Keep | P0 | Needed for scenario health/status. |
| [events/core/aggregateLevelAccuracy.ts](../events/core/aggregateLevelAccuracy.ts) | Level-level aggregate from scenarios. | Keep | P0 | Needed for level/game score reporting. |
| [events/core/eventsRuntimeDerived.ts](../events/core/eventsRuntimeDerived.ts) | Derived runtime selectors and helper logic. | Keep | P1 | Keep as pure derivation module. |
| [events/core/replayDiagnostics.ts](../events/core/replayDiagnostics.ts) | Groups and summarizes replay diagnostics. | Keep | P1 | Important debug/UX surface. |
| [events/core/eventSequenceDiffUrls.ts](../events/core/eventSequenceDiffUrls.ts) | Diff url keying and resolution by step/scenario. | Keep | P1 | Core artifact resolution. |
| [events/core/eventSequenceSolutionUrls.ts](../events/core/eventSequenceSolutionUrls.ts) | Solution url keying and fallback resolution. | Keep | P1 | Core artifact resolution. |
| [events/core/browserSolutionPreflightStore.ts](../events/core/browserSolutionPreflightStore.ts) | Registry for deferred browser solution capture runner. | Keep | P1 | Needed by current browser capture flow. |
| [events/core/imageUtils.ts](../events/core/imageUtils.ts) | Pixel/image conversion helpers for comparisons. | Keep | P1 | Needed by compare/replay paths. |
| [events/core/interactionEvents.ts](../events/core/interactionEvents.ts) | Normalizes interaction events and replay-only behavior. | Keep | P1 | Important event correctness layer. |
| [events/core/eventSequenceMetricsTypes.ts](../events/core/eventSequenceMetricsTypes.ts) | Metrics type definitions. | Keep | P2 | Small type utility. |
| [events/core/eventSequenceReplayTypes.ts](../events/core/eventSequenceReplayTypes.ts) | Replay/runtime type definitions and constants. | Keep | P0 | Shared contracts used widely. |
| [events/core/interactionEvents.test.ts](../events/core/interactionEvents.test.ts) | Tests event normalization behavior. | Keep | P0 | Important safety net; should expand over time. |

---

## D) Direct ArtBoards consumers (integration map)

| File | How it uses events | Future status |
|---|---|---|
| [components/ArtBoards/ArtBoards.tsx](../components/ArtBoards/ArtBoards.tsx) | Mounts EventsBoundScenarioDrawing, EventsBoundScenarioModel, run buttons, sequence panel. | Keep integration point; should stay thin. |
| [components/ArtBoards/Drawboard/DrawBoard.tsx](../components/ArtBoards/Drawboard/DrawBoard.tsx) | Uses EventProvider and EventsBoundScenarioDrawing. | Keep; ensure context order remains valid. |
| [components/ArtBoards/ScenarioContext.tsx](../components/ArtBoards/ScenarioContext.tsx) | Uses runtime hooks and scenario-event bridge. | Keep as boundary owner; avoid leaking internals out. |
| [components/ArtBoards/GameContext.tsx](../components/ArtBoards/GameContext.tsx) | Reads level aggregates and capture store for scoring sync. | Keep; maintain one-way aggregation flow. |
| [components/ArtBoards/LevelContext.tsx](../components/ArtBoards/LevelContext.tsx) | Uses level aggregate types and values. | Keep. |
| [components/ArtBoards/Frame.tsx](../components/ArtBoards/Frame.tsx) | Uses replay state/stores and solution keying. | Refactor integration once replay store consolidation happens. |
| [components/ArtBoards/ModelBoard/Diff/Diff.tsx](../components/ArtBoards/ModelBoard/Diff/Diff.tsx) | Uses timeline selection and diff resolution helpers. | Keep; update only if asset API changes. |
| [components/ArtBoards/ModelBoard/ScenarioModel.tsx](../components/ArtBoards/ModelBoard/ScenarioModel.tsx) | Uses initial step constants for model behavior. | Keep. |
| [components/ArtBoards/Drawboard/ScenarioDrawing.tsx](../components/ArtBoards/Drawboard/ScenarioDrawing.tsx) | Reads ScenarioDrawingContext for orchestrated values. | Keep; this is a good boundary. |

---

## E) What should definitely stay

These are mandatory capabilities and must be preserved through cleanup:
- Create steps, edit steps, and select steps in scenario timeline.
- Run/replay sequence and stop replay.
- Per-step accuracy capture and display.
- Stale-to-fresh accuracy transitions when drawing changes.
- Per-step solution and diff artifact resolution.
- Creator and gameplay flows both working with same context hierarchy.

---

## F) Main bloat sources right now

- Large orchestrator files:
  - [events/components/EventsBoundScenarioDrawing.tsx](../events/components/EventsBoundScenarioDrawing.tsx)
  - [events/components/EventsBoundScenarioModel.tsx](../events/components/EventsBoundScenarioModel.tsx)
- Broad runtime hooks:
  - [events/hooks/useScenarioRuntimeState.ts](../events/hooks/useScenarioRuntimeState.ts)

  - [events/hooks/useStepCompareOrchestration.ts](../events/hooks/useStepCompareOrchestration.ts)
- Replay state overlap across multiple stores:
  - [events/core/sequenceReplayStore.ts](../events/core/sequenceReplayStore.ts)
  - [events/core/eventSequenceReplayBatchStore.ts](../events/core/eventSequenceReplayBatchStore.ts)
  - [events/core/eventSequenceReplayUiStore.ts](../events/core/eventSequenceReplayUiStore.ts)
  - [events/core/eventSequenceRunStore.ts](../events/core/eventSequenceRunStore.ts)

---

## G) Migration plan (implementation order)

### Phase 1: zero-behavior cleanup
- Add small internal hooks for repeated effects/callbacks in both orchestrator files.
- Move diagnostics/toast derivation out of EventSequencePanel into dedicated hooks.
- Keep behavior identical.

### Phase 2: replay-store consolidation
- Choose one replay store shape.
- Merge run flag, batch session, and replay UI journey/diagnostics into one store.
- Keep [events/core/eventSequenceFacades.ts](../events/core/eventSequenceFacades.ts) as only multi-store write API.

### Phase 3: runtime-hook split
- Split [events/hooks/useScenarioRuntimeState.ts](../events/hooks/useScenarioRuntimeState.ts) into read model hook and action hook.
- Split artifact hook responsibilities in [events/hooks/useScenarioArtifacts.ts](../events/hooks/useScenarioArtifacts.ts).

### Phase 4: orchestrator thinning
- Extract reusable frame/capture/request logic from drawing and model orchestrators into shared hooks.
- Remove duplicated branching and repeated setup/cleanup code.

### Phase 5: integration cleanup
- Update [components/ArtBoards/Frame.tsx](../components/ArtBoards/Frame.tsx) to new replay store boundaries.
- Keep context data flow unchanged:
  Game -> Level -> Scenario -> Events -> Event

---

## H) Verification checklist per migration slice

- Type check and lint pass on touched files.
- Smoke test creator flow:
  - create step
  - edit step
  - select step
  - run sequence
  - stop sequence
- Smoke test gameplay flow:
  - active step progression
  - pending-step gating
  - accuracy updates
- Verify stale-to-fresh behavior after drawing changes.
- Verify sequence panel diagnostics and replay header states.
- Verify model/diff urls still resolve by step.

---

## I) Recommended first PR boundaries

1. PR 1: Extract local hooks from orchestrators (no store schema changes)
2. PR 2: Replay store consolidation plus facade updates
3. PR 3: Scenario runtime hook split and artifact hook split
4. PR 4: ArtBoards integration updates and final cleanup

Each PR should be concern-separated and behavior-preserving.
