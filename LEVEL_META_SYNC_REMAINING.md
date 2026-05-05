# Level meta sync — wiring status

All planned `syncLevelFields` call sites from the original checklist are implemented except where noted below.

## Implemented

| Area | Fields synced | Notes |
|------|---------------|--------|
| **ThresholdsEditor** | `pointsThresholds`, `percentageTreshold`, `percentageFullPointsTreshold` | Matches `updatePointsThresholds` reducer |
| **Info guide** | `instructions` | Guide content lives in `level.instructions` (not `help`) |
| **ScenarioModel** | `showSolutionImageInsteadOfDiff` | After `toggleShowModelSolution` |
| **ScenarioDrawing** | `interactive` | After `toggleImageInteractivity` (non-creator path); `removeScenario` was already wired |
| **InfoColors** | `buildingBlocks` | After `updateLevelColors` |
| **Max points** | `maxPoints` | Via `LevelData` → `InfoInput` `levelMetaSyncFields` |

## Optional / N/A

- **`changeAccuracyTreshold`** — No UI currently dispatches it (thresholds are edited via **ThresholdsEditor**, which syncs the percentage fields above). If you add a `LevelData` field for it, pass `levelMetaSyncFields={["percentageTreshold"]}` (or wire the action in **InfoInput** the same way as max points).
- **`toggleShowScenarioModel` / `toggleShowHotkeys`** — Reducers exist but nothing in `components/` dispatches them; nothing to wire until those toggles are added to the UI.
- **`updateSolutionCode`** — Creator solution text is synced via **Yjs** (`getYSolutionText` observers → Redux). Sending full `solution` over `level-meta-update` would duplicate that channel; intentionally omitted.

## Pattern (reference)

```tsx
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";

const { syncLevelFields } = useLevelMetaSync();
dispatch(someAction({ levelId: currentLevel, ... }));
syncLevelFields(currentLevel - 1, ["fieldName"]);
```

## Testing

Same as before: two creator tabs on the same room, change metadata in tab A, confirm tab B updates without reload; console `[LevelMetaSync] applying remote update` and server `[level-meta-update:update-meta]` logs.
