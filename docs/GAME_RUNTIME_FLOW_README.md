# Game Runtime Flow README

This document explains how the game currently works at runtime, with the unified step model:

## Basic Game Structure
A Game is a collection of levels. Each Game has one or more levels. You use game settings to configure how the game behaves, for example whether it has a time limit or not.

## Basic Level Structure
Single game level consists of two artboards (drawing and solution) and an editor. The users task is to replicate the solution drawing in the drawing artboard using HTML, CSS and JavaScript. 

## Variations
Each level can also have variations. Variations are created from the existing level. If a level has variations, the user playing the game will be randomly assigned one of the variations. Variations are used to create different versions of the same level, for example with different colors or shapes, without having to create a whole new level from scratch.

## Scenarios
Each level has one or more scenarios. All scenarios of the same variation of a level share the same HTML/CSS/JavaScript with other scenarios of the same variation, but they can have different dimensions or event sequences. By default, a level only has one scenario. 

## Event Sequences
Event sequences are a series of steps that can be authored for each scenario. They allow the user to create a timeline of events that can be used to test the player's solution at different points in time/states of interaction. For example, an event sequence can be used to simulate a users interaction with a form to see if the player's solution can handle it correctly. By default, a scenario has no events, which means it only has one step (`__initial__`). You add events to a scenario to create more steps in the event sequence tools. 


---

# LOGIC THAT MAKES THIS ALL WORK TOGETHER

## Boot flow (game route)

```
/game/[gameId] page
  └─ GamePageClient.tsx
       └─ useGamePageBootstrap.ts        ← fetches game record, instance, resolves roomId
            └─ useGameStore.setCurrentGameId
  └─ App.tsx (mounted inside layout)
       └─ 292-line useEffect             ← fetches levels + map, hydrates Yjs editors,
            |                               applies variant assignments, restores ?level param
            └─ mounts invisible coordinators:
                 ProgressionSync          ← syncs progress from collaboration room
                 ProgressPersistence      ← persists progress to server
                 LevelMetaSync            ← syncs level meta (title, desc) to Redux
                 GameplayTelemetryTracker ← tracks telemetry events
                 LevelUpdater             ← bridges drawboard iframe → Redux accuracy
                 GameboardTourController  ← controls onboarding tour
```

## Artboard render chain (per scenario)

```
ArtBoards.tsx
  └─ ScenarioContext.Provider            ← supplies artifacts, current scenario, creator flag
       └─ EventsBoundScenarioDrawing.tsx  ← orchestrates 6 event-sequence hooks
            └─ ScenarioDrawingContext.Provider
                 └─ ScenarioDrawing.tsx  ← renders Frame + Image + FrameJsErrorOverlay
```

## Step resolution (canonical path)

1. **Selected step** — `useEventSequenceStore.selectedStepIdByScenario[${levelId}:${scenarioId}]` (user clicked a step in the timeline)
2. **Active step** — `runtimeByKey[runtimeKey].activeIndex` → step at that index (game route auto-advance)
3. **Fallback** — `__initial__` (no events or first load)

`resolveGameActiveStepId` in `events/core/eventsRuntimeDerived.ts` is the canonical implementation of this logic.

## Pixel / accuracy flow

```
drawboard iframe
  └─ postMessage { type: "pixels", ... }
       └─ LevelUpdater.tsx window.addEventListener("message")
            ├─ drawboardPixelsStore.notifyDrawboardPixels()   ← module-level map store
            └─ ScenarioUpdater (per scenario)
                 └─ updateLevelAccuracyByIndexThunk → points.slice
```

Event-sequence accuracy uses a parallel path:
```
useStepAccuracyEngine.ts
  └─ drawboardPixelsStore pixel pairs
       └─ aggregateEventSequenceAccuracy
            └─ updateLevelAccuracyByIndexThunk (meanKnown=true) → points.slice
```

## State systems (5 separate)

| System | What lives there |
|---|---|
| **Redux (10 slices)** | levels, currentLevel, score, room, options, differenceUrls, drawingUrls, solutionUrls, solutions, points |
| **Zustand — eventSequenceStore** | runtime per scenario-key, selected/current step IDs, panel open state, auto-replay queues |
| **Zustand — gameStore** | current game record, game list |
| **Module Maps (drawboardPixelsStore)** | pixel pairs, accuracy results, replay signatures — 9 maps total |
| **React Context** | ScenarioContext, ScenarioDrawingContext, EventsContext, CollaborationProvider, DrawboardNavbarCaptureContext |

---

# FAULTS THAT BREAK THIS LOGIC

## F1 — Production debug code: localhost ingest fetches
**Files:** `events/components/eventsRuntimeContext.tsx`, `events/hooks/useAutoReplaySequence.ts`  
**Problem:** Both fire fetch requests to `http://127.0.0.1:7450/ingest/cb7bd925-...` in production. These silently fail in prod but add noise and risk leaking event data if a local agent happens to be running.  
**Fix:** Delete both fetch calls entirely.

## F2 — Leftover debug logging
**Files:** `store/store.ts` (dispatchLoggerMiddleware logs every 5s), `events/core/eventSequenceState.ts` startAutoReplay (`console.log("LOLOLO Starting auto replay...")`)  
**Fix:** Delete both.

## F3 — Double-write on pixel postMessage
**File:** `components/General/LevelUpdater.tsx`  
**Problem:** The `window` "message" handler writes pixel data into both `drawboardPixelsStore.notifyDrawboardPixels()` AND local React state `drawingPixels`/`solutionPixels`. Downstream consumers read from both — any ordering issue causes stale accuracy computations.  
**Fix:** Single write to `drawboardPixelsStore`; downstream reads only from there.

## F4 — currentStepIdByScenario stored map is redundant derived state
**File:** `events/core/eventSequenceState.ts`  
**Problem:** `currentStepIdByScenario` is fully derivable from `selectedStepIdByScenario` + `runtimeByKey.activeIndex` + sequence list. Storing it separately means two sources of truth for "what step am I on" — they can diverge.  
**Fix:** Delete stored map; replace all reads with call to `resolveGameActiveStepId` selector.

## F5 — options.creator redundant with options.mode
**File:** `store/slices/options.slice.ts`  
**Problem:** Both `options.creator: boolean` and `options.mode: Mode` exist. `mode === "creator"` implies `creator === true`, but code checks both inconsistently. In at least one place the creator route redirects to the game route when `canEditCurrentGame` is false — this produces `mode="creator"` but `creator=false` transiently before redirect fires.  
**Fix:** Delete `options.creator`; derive from `options.mode === "creator"` at all call sites.

## F6 — sanitizeReplayProgressData split across two files
**Files:** `app/game/[gameId]/GamePageClient.tsx` lines 28–37, `components/General/ProgressPersistence.tsx`  
**Problem:** Two different sanitization implementations. The GamePageClient version only strips `finishedAt`/`finalScore`; ProgressPersistence does deeper cleaning. Divergence means data inconsistencies between client-side reset and persistence sanitization.  
**Fix:** Single `sanitizeReplayProgressData` util; both import it.

## F7 — module-mutable singletons break HMR and test isolation
**Files:** `components/General/ProgressionSync.tsx` (`hasSynced`), `events/hooks/useSequenceRuntimeLifecycle.ts` (`playwrightGameInteractiveBootstrappedLevel`)  
**Problem:** Module-level mutable vars survive hot reload and bleed between tests.  
**Fix:** Move into React ref or Zustand store keyed by gameId.

## F8 — stepAccuracyVersions parallel map anti-pattern
**File:** `events/core/eventSequenceState.ts` `SequenceRuntimeState`  
**Problem:** `stepAccuracies` and `stepAccuracyVersions` are two maps with identical keys. Updating one without the other causes stale version checks.  
**Fix:** Merge into single map `{ [stepId]: { accuracy: number, version: number } }`.

## F9 — ScenarioDrawing creator/player branch duplicates 130 lines of JSX
**File:** `components/ArtBoards/Drawboard/ScenarioDrawing.tsx` lines 193–322  
**Problem:** `isCreator` branch and player branch both render Frame + Image + FrameJsErrorOverlay with near-identical prop sets. Any change must be applied twice.  
**Fix:** Extract `<DrawingSurface>` subcomponent taking the differing props.

## F10 — unused dead exports
**Files:** `components/General/LevelUpdater.tsx`, `components/General/ScenarioUpdater.tsx`  
**Problem:** Both export `export const scenarioDiffs = {}`. No live consumer. Likely copy-paste artifact.  
**Fix:** Delete both.

---

# LOGIC THAT IS DUPLICATE AND NEEDS TO BE COMBINED OR REFACTORED

## D1 — Step resolution: 4 implementations

| Location | Implementation |
|---|---|
| `events/core/eventsRuntimeDerived.ts` | `resolveGameActiveStepId` — canonical |
| `components/General/LevelUpdater.tsx` lines 55–84 | `resolveCurrentStepIdForScenario` — near-identical logic |
| `components/Navbar/Navbar.tsx` line ~218 | inline `selectedEventSequenceStepId ?? gameplayActiveSequenceStep?.id` |
| `events/hooks/useStepAccuracyEngine.ts` line 113 | inline `focusedId = selectedEventSequenceStepId?.trim() \|\| (!isCreator ? gameplayActiveSequenceStep?.id ?? null : null)` |

**Fix:** All call sites use `resolveGameActiveStepId`. Delete the other 3.

## D2 — Mode/route detection: 4 places

| Location | How it detects |
|---|---|
| `store/slices/options.slice.ts` | `options.creator` + `options.mode` (Redux) |
| `components/App.tsx` | `pathname.startsWith("/creator/")` |
| `components/ArtBoards/ScenarioContext.tsx` | `pathname.startsWith("/creator/")` |
| `components/Navbar/Navbar.tsx` | `normalizedPathname.startsWith("/creator/")` |

**Fix:** Single `useIsCreatorRoute` hook derived from pathname; delete `options.creator`.

## D3 — Game bootstrap: 2 parallel flows

| Location | What it does |
|---|---|
| `app/game/[gameId]/_hooks/useGamePageBootstrap.ts` (403 lines) | fetches game record + instance, resolves roomId, sets currentGameId |
| `components/App.tsx` 292-line useEffect | fetches levels + map, hydrates Yjs, applies variant assignments, restores URL params |

Both trigger on `currentGame.id` change. Neither knows about the other. Race conditions possible when game changes mid-session.  
**Fix:** Compose both into single bootstrap pipeline with explicit phase ordering.

## D4 — Pixel storage: 2 stores

| Location | What it stores |
|---|---|
| `lib/drawboard/drawboardPixelsStore.ts` | module Maps: pairsByScenario, serialByScenario, sideSerialsByScenario, replaySignaturesByScenario, accuracyResults (9 maps) |
| `components/General/LevelUpdater.tsx` | React state: `drawingPixels`, `solutionPixels` per scenario+step |

Same postMessage payload written to both.  
**Fix:** Canonical store = `drawboardPixelsStore`. Delete local state from LevelUpdater.

## D5 — Descriptor/artifact construction: 3 places

| Location | |
|---|---|
| `events/hooks/useScenarioArtifacts.ts` | hook — canonical |
| `components/General/LevelUpdater.tsx` lines 146–209 | inline construction |
| `components/ArtBoards/ScenarioContext.tsx` line ~84 | `selectedScenarioDrawingArtifactDescriptor` |

**Fix:** All use `useScenarioArtifacts`. Delete inline copies.

## D6 — Accuracy dispatch: 2 entry points to same thunk

| Location | Call |
|---|---|
| `components/General/ScenarioUpdater.tsx` | `updateLevelAccuracyByIndexThunk(..., meanAccuracyKnown=undefined)` |
| `events/hooks/useStepAccuracyEngine.ts` line 238 | `updateLevelAccuracyByIndexThunk(..., meanKnown=true)` via `aggregateEventSequenceAccuracy` |

Both dispatch to same Redux thunk. The `meanAccuracyKnown` flag diverges between them, and both can fire on the same scenario-step concurrently.  
**Fix:** Single accuracy dispatch path; ScenarioUpdater delegates to event sequence engine when steps exist.

## D7 — Points recalculation: 5 paths in one slice

**File:** `store/slices/points.slice.ts`  
`initializePoints`, `refreshPoints`, `updateLevelAccuracy`, `recalculateLevelPoints`, `mergeSavedPoints` each iterate all levels and sum. Plus `store/actions/score.actions.ts` `updatePointsThunk` does it again.  
**Fix:** Single `recalculateAll` private reducer called by the others.

## D8 — Auto-replay: 3 overlapping hooks

| Hook | Responsibility |
|---|---|
| `useEventsAutoReplayOrchestration.ts` (106 lines) | queues `queuedAutoReplayRequest`, calls `startAutoReplay` |
| `useAutoReplaySequence.ts` (151 lines) | sequential iteration via `setSelectedStep` + `waitForStepAccuracy` |
| `useBatchReplayOrchestration.ts` (233 lines) | batch via `drawingFrameRef.current.requestReplayBatch` + per-step `runPixelComparison` |

No single source of truth for "is a replay in progress." All three write to `useEventSequenceStore` runtime.  
**Fix:** Single replay orchestrator; the others become internal phases.

---

# LOGIC RELATED TO THIS THAT ARE GOD COMPONENTS

## G1 — components/App.tsx (710 lines)

**Responsibilities (should be ~1):**
- Route/mode detection and redirect logic
- Level + map fetching (duplicate of useGamePageBootstrap)
- Yjs YText hydration per editor per level
- Variant assignment application
- Points restoration from `progressData`
- URL `?level` param → Redux `currentLevel`
- Layout resize via ResizeObserver → `contentRowWidth`
- LTI iframe height postMessage
- Mounting 6 invisible coordinator components

**Core problem:** The 292-line `useEffect` (lines 289–581) has 6 tracking refs and handles effectively the entire game boot sequence inline.

**Split into:**
- `useGameLevelBootstrap` hook (levels fetch + Yjs hydration + variant assignment)
- `useGameUrlSync` hook (URL params ↔ Redux)
- `useLtiHeightSync` hook (LTI postMessage)
- Layout component for resize logic
- Keep App.tsx as thin composition root

## G2 — components/Navbar/Navbar.tsx (1060 lines)

**Responsibilities:**
- Mode-aware layout (4 render variants: compact/inline × creator/player)
- Level reset dialog (level scope + game scope)
- Shared room reset
- Event recording controls (single/continuous/idle)
- `clearEventSequenceForScenario` + remove-last-step + setScenarioInteractive actions
- Portal render of `CreatorWorkbenchSubSidebar` via DOM id
- localStorage persistence of `creatorWorkbenchPanels` state
- LevelSelect, tour spots, map editor dialog, game lobby nav, AplusSubmitButton, InfoGamePoints

**Split into:**
- `CreatorNavbar` + `PlayerNavbar` top-level components
- `RecordingControls` component
- `EventSequenceNavActions` component
- `LevelResetDialog` component (already partially extracted)
- localStorage persistence into dedicated hook

## G3 — events/core/eventSequenceState.ts (548 lines)

**Responsibilities:**
- 7 separate Zustand keyed maps (see F4, F8)
- `SequenceRuntimeState` with 8 fields, two of which are parallel maps (stepAccuracies + stepAccuracyVersions)
- Auto-replay queue management
- Recording mode state

**Split into:**
- `runtimeStore` — per-scenario-key execution state (activeIndex, accuracies, replay)
- `selectionStore` — selected/current step per scenario
- `uiStore` — panel open state, recording mode
- Delete `currentStepIdByScenario` (derivable)

## G4 — components/General/LevelUpdater.tsx (431 lines)

**Responsibilities:**
- `window` message listener for drawboard pixel events
- Fan-out to one `ScenarioUpdater` per scenario
- Local duplicate pixel state (duplicate of drawboardPixelsStore)
- Step ID resolution (duplicate of resolveGameActiveStepId)
- Descriptor construction (duplicate of useScenarioArtifacts)

**What it uniquely owns:** The `window.addEventListener("message")` fan-out.  
**Fix:** Move message listener into `drawboardPixelsStore`; reduce LevelUpdater to thin fan-out or delete it.

## G5 — app/game/[gameId]/_hooks/useGamePageBootstrap.ts (403 lines)

**Responsibilities:**
- Fetch game record + handle not-found / access-denied
- Fetch or create game instance
- Resolve collaboration roomId
- Handle group lobby vs active instance routing
- Apply guest token from URL
- Handle instance reset postMessage from GamePageClient

**Mostly legitimate** — but instance creation and room resolution should be separate hooks composed here rather than inlined.
