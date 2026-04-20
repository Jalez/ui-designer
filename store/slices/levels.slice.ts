/** @format */

import { createSlice } from "@reduxjs/toolkit";
import confetti from "canvas-confetti";
import { backendStorage } from "@/lib/utils/backendStorage";
import { EventSequenceStep, Level, VerifiedInteraction, difficulty } from "@/types";
import { gameMaxTime } from "@/constants";
import {
  DEFAULT_POINTS_THRESHOLDS,
  applyPointsThresholdsInPlace,
  ensurePointsThresholdsOnLevel,
} from "@/lib/levels/pointsThresholds";
import {
  BASE_LEVEL_VARIANT_ID,
  addLevelVariantFromCurrentView,
  normalizeLevelVariants,
  removeLevelVariant,
  serializeLevelForPersistence,
  setLevelVariantView,
} from "@/lib/levels/variants";
import {
  appendNormalizedEventSequenceStep,
  normalizeEventSequence,
  normalizeInteractionArtifacts,
  normalizeInteractionTriggers,
} from "@/events/core/interactionEvents";
// allLevels will be set by the App component when levels are loaded
export let allLevels: Level[] = [];
export const setAllLevels = (levels: Level[]) => {
  allLevels = levels.map((level) =>
    normalizeLevelVariants(ensurePointsThresholdsOnLevel({
      ...level,
      eventSequence: normalizeEventSequence(level.eventSequence) ?? { byScenarioId: {} },
      events: normalizeInteractionTriggers(level.events as never),
      interactionArtifacts: normalizeInteractionArtifacts(level.interactionArtifacts) ?? { byScenarioId: {} },
    }), "game"),
  );
};

function persistLevelsState(state: Level[]) {
  storage?.setItem(storage.key, JSON.stringify(state.map((level) => serializeLevelForPersistence(level))));
}

type scenarioSolutionUrls = {
  [key: string]: string;
};
export const scenarioSolutionUrls: scenarioSolutionUrls = {};

const maxCodeLength = 100000;

let storage: ReturnType<typeof backendStorage> | null = null;
let activeGameId: string | null = null;
let activeMapName = "all";
let activeMode = "game";

export const getActiveMapName = () => activeMapName;

const templateWithoutCode = {
  question_and_answer: {
    question: "",
    answer: "",
  },
  week: "all",
  instructions: [],
  eventSequence: { byScenarioId: {} },
  events: [],
  interactionArtifacts: { byScenarioId: {} },
  help: {
    description: "",
    images: [],
    usefullCSSProperties: [],
  },
  difficulty: "easy" as difficulty,
  points: 0,
  maxPoints: 100,
  percentageTreshold: 70,
  percentageFullPointsTreshold: 95,
  pointsThresholds: DEFAULT_POINTS_THRESHOLDS.map((t) => ({ ...t })),
  accuracy: 0,
  interactive: false,
  showModelPicture: false,
  showHotkeys: false,
  showScenarioModel: false,
  lockHTML: false,
  lockCSS: false,
  lockJS: false,
  scenarios: [],
  timeData: {
    startTime: 0,
    pointAndTime: {},
  },
  confettiSprinkled: false,
  completed: "no",
};
// Timer storage for tracking game start time
const timerStorage = backendStorage("ui-designer-start-time");

// Get initial state from sessionStorage (cached) or use empty array
// The actual data will be synced from backend on mount
let initialState: Level[] = [];
// get current time in milliseconds
const currentTime = new Date().getTime();
// get the time the user started the game from cache
const lastUpdated = timerStorage.getItem(timerStorage.key);
if (lastUpdated && currentTime - parseInt(lastUpdated) > gameMaxTime) {
  initialState = [];
  // Reset timer if expired
  timerStorage.setItem(timerStorage.key, currentTime.toString());
} else if (!lastUpdated) {
  // Set initial timer
  timerStorage.setItem(timerStorage.key, currentTime.toString());
}

const levelsSlice = createSlice({
  name: "levels",
  initialState: [] as Level[],

  reducers: {
    evaluateLevel(state, action) { },
    updateWeek(state, action) {
      const { levels, gameId, mode, forceFresh } = action.payload;
      let { mapName } = action.payload;
      if (!mapName) mapName = "all";
      activeGameId = gameId || null;
      activeMapName = mapName;
      activeMode = mode || "game";
      const normalizedLevels = levels.map((level: Level) =>
        normalizeLevelVariants(ensurePointsThresholdsOnLevel({
          ...level,
          eventSequence: normalizeEventSequence(level.eventSequence) ?? { byScenarioId: {} },
          events: normalizeInteractionTriggers(level.events as never),
          interactionArtifacts: normalizeInteractionArtifacts(level.interactionArtifacts) ?? { byScenarioId: {} },
        }), activeMode === "creator" ? "creator" : "game"),
      );

      if (activeMode === "game" && activeGameId) {
        // Gameplay code is owned by the websocket room state.
        // Clearing storage here prevents any creator-mode cache from leaking into gameplay.
        storage = null;
        return normalizedLevels;
      }

      // Scope cache by game ID so different games don't share stale level state
      const cacheKey = gameId ? `ui-designer-${mapName}-${gameId}` : `ui-designer-${mapName}`;
      storage = backendStorage(cacheKey);
      if (forceFresh) {
        storage.setItem(storage.key, JSON.stringify(normalizedLevels.map((level) => serializeLevelForPersistence(level))));
        return normalizedLevels;
      }
      // Try to get from sessionStorage cache first
      const cached = storage.getItem(storage.key);
      if (cached) {
        try {
          const cachedLevels = JSON.parse(cached);
          if (cachedLevels.length > 0) {
            // Sanitize: strip any identifier that isn't a valid UUID so old
            // short random strings (e.g. "w4zenm") don't block saving.
            const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const sanitized = cachedLevels.map((level: Level) =>
              normalizeLevelVariants(ensurePointsThresholdsOnLevel({
                ...level,
                identifier: level.identifier && UUID_RE.test(level.identifier)
                  ? level.identifier
                  : undefined,
                eventSequence: normalizeEventSequence(level.eventSequence) ?? { byScenarioId: {} },
                events: normalizeInteractionTriggers(level.events as never),
                interactionArtifacts: normalizeInteractionArtifacts(level.interactionArtifacts) ?? { byScenarioId: {} },
              }), activeMode === "creator" ? "creator" : "game"),
            );
            return sanitized;
          }
        } catch (e) {
          console.error("Failed to parse cached levels:", e);
        }
      }
      // No cached data — use fresh levels from backend
      storage.setItem(storage.key, JSON.stringify(normalizedLevels.map((level) => serializeLevelForPersistence(level))));
      return normalizedLevels;
    },

    snapshotCreatorCodes(state) {
      // Save current level.code into allLevels so resetAllLevelCodes can restore them later.
      // allLevels can point at a frozen/readonly array, so never mutate indices in place.
      allLevels = allLevels.map((original, index) => {
        const level = state[index];
        if (!original || !level) {
          return original;
        }

        return { ...original, code: { ...level.code } };
      });
    },
    resetAllLevelCodes(state) {
      // Restore every level's template code to the original source, discarding test-mode edits
      state.forEach((level, index) => {
        const original = allLevels[index];
        if (original) {
          level.code = { ...original.code };
        }
      });
      persistLevelsState(state);
    },
    resetLevel(state, action) {
      const level = state[action.payload - 1];
      if (!level) return;

      level.confettiSprinkled = false;
      level.timeData.pointAndTime = {};
      const newGeneration = allLevels[action.payload - 1];
      level.code = newGeneration.code;
      level.instructions = newGeneration.instructions;
      level.question_and_answer = newGeneration.question_and_answer;

      level.scenarios?.forEach((scenario) => {
        scenario.accuracy = 0;
      });

      // level.timeData.startTime = new Date().getTime();

      persistLevelsState(state);
    },
    updateAccuracy(state, action) {
      const { currentLevel, scenarioId, accuracy } = action.payload;
      const level = state[currentLevel - 1];
      if (!level) return;
      const scenario = level.scenarios?.find(
        (scenario) => scenario.scenarioId === scenarioId
      );
      if (!scenario) return;
      scenario.accuracy = accuracy;
      persistLevelsState(state);
    },
    sprinkleConfetti(state, action) {
      const level = state[action.payload - 1];
      if (!level) return;
      if (level.confettiSprinkled) return;
      confetti({ particleCount: 100 });
      level.confettiSprinkled = true;
      persistLevelsState(state);
    },
    completeLevel(state, action) {
      const level = state[action.payload - 1];
      if (!level) return;
      level.completed = "yes";
      persistLevelsState(state);
    },
    updateLevelPoints(state, action) {
      const { levelId, points } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.points = points;
      persistLevelsState(state);
    },
    updatePoints(state, action) {
      console.log("STILL CALLING UPDATE-POINTS: DEPRECATED");
    },
    toggleShowModelSolution(state, action) {
      const level = state[action.payload - 1];
      if (!level) return;
      level.showModelPicture = !level.showModelPicture;
      persistLevelsState(state);
    },
    startLevelTimer(state, action) {
      const level = state[action.payload - 1];
      if (!level) return;
      level.timeData.startTime = new Date().getTime();
      persistLevelsState(state);
    },
    startLevelTimerAt(state, action) {
      const { levelId, startTime } = action.payload as { levelId: number; startTime: number };
      const level = state[levelId - 1];
      if (!level) return;
      level.timeData.startTime = startTime;
      persistLevelsState(state);
    },
    updateSolutionCode(state, action) {
      const { id, code } = action.payload;
      const level = state[id - 1];
      if (!level) return;
      if (
        level.solution?.html === code?.html &&
        level.solution?.css === code?.css &&
        level.solution?.js === code?.js
      ) {
        return;
      }
      level.solution = code;
      persistLevelsState(state);
    },

    updateCode(state, action) {
      const { id, code } = action.payload;
      const level = state[id - 1];

      if (!level) return;
      if (
        level.code?.html === code?.html &&
        level.code?.css === code?.css &&
        level.code?.js === code?.js
      ) {
        return;
      }
      //console.log("updateCode");
      if (
        (code.html && code.html.length > maxCodeLength) ||
        (code.css && code.css.length > maxCodeLength) ||
        (code.js && code.js.length > maxCodeLength)
      ) {
        //console.error("Code is too long!");
        return;
      }

      // go through scenarios and make sure the solution url is not in the code
      for (const scenario of level.scenarios || []) {
        const scenarioUrl = scenarioSolutionUrls[scenario.scenarioId];
        if (
          scenarioUrl &&
          (code.css.includes(scenarioUrl) ||
            code.html.includes(scenarioUrl) ||
            code.js.includes(scenarioUrl))
        ) {
          console.error(
            "Note: Using the solutions own image url isn't allowed!"
          );
          return;
        }
      }

      if (code.html.includes("<script>")) {
        console.error("Using scripts isn't allowed!");
        return;
      }
      // //console.log("updateCode", code.html, code.css, code.js);
      // //console.log("level.code", code);
      level.code = code;
      persistLevelsState(state);
    },

    toggleImageInteractivity(state, action) {
      const level = state[action.payload - 1];
      if (!level) return;
      level.interactive = !level.interactive;
      persistLevelsState(state);
    },
    toggleShowScenarioModel(state, action) {
      const { levelId, scenarioId } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.showScenarioModel = !level.showScenarioModel;
      persistLevelsState(state);
    },
    toggleShowHotkeys(state, action) {
      const level = state[action.payload - 1];
      if (!level) return;
      level.showHotkeys = !level.showHotkeys;
      persistLevelsState(state);
    },
    changeLevelDifficulty(state, action) {
      const { levelId, difficulty } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.difficulty = difficulty;
      persistLevelsState(state);
    },
    changeAccuracyTreshold(state, action) {
      const { levelId, text } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.percentageTreshold = Number(text);
      persistLevelsState(state);
    },
    updatePointsThresholds(state, action) {
      const { levelId, thresholds } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      const sortedThresholds = [...thresholds].sort((a, b) => a.accuracy - b.accuracy);
      level.pointsThresholds = sortedThresholds;
      if (sortedThresholds.length > 0) {
        level.percentageTreshold = sortedThresholds[0].accuracy;
        level.percentageFullPointsTreshold = sortedThresholds[sortedThresholds.length - 1].accuracy;
      }
      persistLevelsState(state);
    },
    changeMaxPoints(state, action) {
      const { levelId, text } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.maxPoints = Number(text);
      persistLevelsState(state);
    },
    changeScenarioDimensions(state, action) {
      const { levelId, scenarioId, dimensionType, value, unit, width, height } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      const scenario = level.scenarios?.find(
        (scenario) => scenario.scenarioId === scenarioId
      );
      if (!scenario) return;
      // Support updating both dimensions at once
      if (width !== undefined) {
        scenario.dimensions.width = width;
      }
      if (height !== undefined) {
        scenario.dimensions.height = height;
      }
      // Support single dimension update (backward compatibility)
      if (dimensionType === "width" || dimensionType === "height") {
        scenario.dimensions[dimensionType] = value;
      }
      if (unit !== undefined) {
        scenario.dimensions.unit = unit;
      }
      persistLevelsState(state);
    },

    addNewScenario(state, action: { payload: number }) {
      const level = state[action.payload - 1];
      if (!level) return;
      const newScenario = {
        scenarioId: Math.random().toString(36).substring(7),
        dimensions: {
          width: 300,
          height: 300,
        },
        accuracy: 0,
        js: "",
      };
      if (!level.scenarios) {
        level.scenarios = [];
      }
      level.scenarios.push(newScenario);
      persistLevelsState(state);
    },
    removeScenario(
      state,
      action: { payload: { levelId: number; scenarioId: string } }
    ) {
      const { levelId, scenarioId } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.scenarios = level.scenarios?.filter(
        (scenario) => scenario.scenarioId !== scenarioId
      );
      persistLevelsState(state);
    },
    setGuideSections(state, action) {
      const { levelId, sections } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.instructions = sections;
      persistLevelsState(state);
    },

    updateGuideSectionItem(state, action) {
      const { levelId, sectionIndex, itemIndex, text } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.instructions[sectionIndex].content[itemIndex] = text;
      persistLevelsState(state);
    },

    updateGuideSectionTitle(state, action) {
      const { levelId, sectionIndex, text } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.instructions[sectionIndex].title = text;
      persistLevelsState(state);
    },
    removeGuideSection(state, action) {
      const { levelId, sectionIndex } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.instructions.splice(sectionIndex, 1);
      persistLevelsState(state);
    },
    removeGuideSectionItem(state, action) {
      const { levelId, sectionIndex, itemIndex } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.instructions[sectionIndex].content.splice(itemIndex, 1);
      persistLevelsState(state);
    },
    addGuideSection(state, action) {
      const { levelId, title, content } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.instructions.push({ title, content });
      persistLevelsState(state);
    },
    addGuideSectionItem(state, action) {
      const { levelId, sectionIndex, text } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.instructions[sectionIndex].content.push(text);
      persistLevelsState(state);
    },
    handleLocking(state, action) {
      //get HTML, CSS or JS from the action, also levelId

      const { levelId, type } = action.payload;
      //Use type to determine which code to lock/unlock
      //Find the level from the state
      const level = state[levelId - 1];
      if (!level) return;
      //Change the lock state of the code
      if (type === "html") {
        level.lockHTML = !level.lockHTML;
      }
      if (type === "css") {
        level.lockCSS = !level.lockCSS;
      }
      if (type === "js") {
        level.lockJS = !level.lockJS;
      }
      //Save the state
      persistLevelsState(state);
    },
    updateLevelName(state, action) {
      const { levelId, text } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.name = text;
      persistLevelsState(state);
    },
    updateLevelEvents(state, action) {
      const { levelId, events } = action.payload as { levelId: number; events: Level["events"] };
      const level = state[levelId - 1];
      if (!level) return;
      level.events = normalizeInteractionTriggers(events as never);
      persistLevelsState(state);
    },
    clearEventSequenceForScenario(state, action) {
      const { levelId, scenarioId } = action.payload as { levelId: number; scenarioId: string };
      const level = state[levelId - 1];
      if (!level || !scenarioId) return;
      if (!level.eventSequence) {
        level.eventSequence = { byScenarioId: {} };
      }
      level.eventSequence.byScenarioId[scenarioId] = [];
      persistLevelsState(state);
    },
    appendEventSequenceStep(state, action) {
      const {
        levelId,
        scenarioId,
        step,
      } = action.payload as { levelId: number; scenarioId: string; step: EventSequenceStep };
      const level = state[levelId - 1];
      if (!level || !scenarioId || !step?.id) return;
      if (!level.eventSequence) {
        level.eventSequence = { byScenarioId: {} };
      }
      const existing = level.eventSequence.byScenarioId[scenarioId] ?? [];
      const nextSequence = appendNormalizedEventSequenceStep(existing, scenarioId, step);
      if (nextSequence === existing) {
        return;
      }
      level.eventSequence.byScenarioId[scenarioId] = nextSequence;
      persistLevelsState(state);
    },
    updateEventSequenceStep(state, action) {
      const {
        levelId,
        scenarioId,
        stepId,
        changes,
      } = action.payload as {
        levelId: number;
        scenarioId: string;
        stepId: string;
        changes: Partial<Pick<EventSequenceStep, "label" | "instruction">>;
      };
      const level = state[levelId - 1];
      const existing = level?.eventSequence?.byScenarioId?.[scenarioId];
      if (!level || !existing?.length) return;
      level.eventSequence!.byScenarioId[scenarioId] = existing.map((entry) => (
        entry.id === stepId
          ? {
            ...entry,
            label: typeof changes.label === "string" ? changes.label : entry.label,
            instruction: typeof changes.instruction === "string" ? changes.instruction : entry.instruction,
          }
          : entry
      ));
      persistLevelsState(state);
    },
    removeEventSequenceStep(state, action) {
      const { levelId, scenarioId, stepId } = action.payload as { levelId: number; scenarioId: string; stepId: string };
      const level = state[levelId - 1];
      const existing = level?.eventSequence?.byScenarioId?.[scenarioId];
      if (!level || !existing) return;
      level.eventSequence!.byScenarioId[scenarioId] = existing
        .filter((entry) => entry.id !== stepId)
        .map((entry, index) => ({ ...entry, order: index }));
      persistLevelsState(state);
    },
    clearInteractionArtifacts(state, action) {
      const { levelId } = action.payload as { levelId: number };
      const level = state[levelId - 1];
      if (!level) return;
      level.interactionArtifacts = { byScenarioId: {} };
      persistLevelsState(state);
    },
    recordVerifiedInteraction(state, action) {
      const {
        levelId,
        scenarioId,
        interaction,
      } = action.payload as { levelId: number; scenarioId: string; interaction: VerifiedInteraction };
      const level = state[levelId - 1];
      if (!level || !scenarioId) return;
      if (!level.interactionArtifacts) {
        level.interactionArtifacts = { byScenarioId: {} };
      }
      const existing = level.interactionArtifacts.byScenarioId[scenarioId] ?? [];
      if (existing.some((entry) => entry.id === interaction.id)) {
        return;
      }
      level.interactionArtifacts.byScenarioId[scenarioId] = [...existing, interaction];
      persistLevelsState(state);
    },
    addThisLevel(state, action) {
      const levelDetails = action.payload;
      const parsedLevelDetails = JSON.parse(levelDetails);
      state.push(
        normalizeLevelVariants(ensurePointsThresholdsOnLevel({
          ...parsedLevelDetails,
          ...templateWithoutCode,
          eventSequence: normalizeEventSequence(parsedLevelDetails.eventSequence) ?? { byScenarioId: {} },
          events: normalizeInteractionTriggers(parsedLevelDetails.events),
          interactionArtifacts: normalizeInteractionArtifacts(parsedLevelDetails.interactionArtifacts) ?? { byScenarioId: {} },
        } as Level), activeMode === "creator" ? "creator" : "game"),
      );
      persistLevelsState(state);
    },
    addNewLevel(state) {
      const newLevel: Level = {
        name: "template",
        code: {
          html: "",
          css: "",
          js: "",
        },
        solution: {
          html: "",
          css: "",
          js: "",
        },
        ...templateWithoutCode,
      };
      state.push(normalizeLevelVariants(newLevel, activeMode === "creator" ? "creator" : "game"));
      persistLevelsState(state);
    },
    removeLevel(state, action) {
      const levelId = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      state.splice(levelId - 1, 1);

      persistLevelsState(state);
    },
    updateLevelColors(state, action) {
      //receives an array of colors
      const { levelId, colors } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      const previousColors = level.buildingBlocks?.colors || [];
      if (
        previousColors.length === colors.length &&
        previousColors.every((color, index) => color === colors[index])
      ) {
        return;
      }
      if (level.buildingBlocks) {
        level.buildingBlocks.colors = colors;
      } else {
        level.buildingBlocks = { colors };
      }
      persistLevelsState(state);
    },
    updateLevelIdentifier(state, action) {
      const { levelId, identifier } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.identifier = identifier;
      persistLevelsState(state);
    },
    addLevelVariant(state, action) {
      const { levelId } = action.payload as { levelId: number };
      const level = state[levelId - 1];
      if (!level) return;
      normalizeLevelVariants(level, "creator");
      addLevelVariantFromCurrentView(level);
      persistLevelsState(state);
    },
    removeLevelVariantById(state, action) {
      const { levelId, variantId } = action.payload as { levelId: number; variantId: string };
      const level = state[levelId - 1];
      if (!level) return;
      normalizeLevelVariants(level, "creator");
      removeLevelVariant(level, variantId);
      persistLevelsState(state);
    },
    setActiveLevelVariant(state, action) {
      const { levelId, variantId } = action.payload as { levelId: number; variantId: string };
      const level = state[levelId - 1];
      if (!level) return;
      normalizeLevelVariants(level, "creator");
      setLevelVariantView(level, variantId || BASE_LEVEL_VARIANT_ID);
      persistLevelsState(state);
    },
    mergeRemoteLevelMeta(
      state,
      action: { payload: { levelIndex: number; fields: Record<string, unknown> } }
    ) {
      const { levelIndex, fields } = action.payload;
      const level = state[levelIndex];
      if (!level || !fields) return;
      for (const [key, value] of Object.entries(fields)) {
        if (key === "code" || key === "versions") continue;
        if (key === "events") {
          (level as Record<string, unknown>)[key] = normalizeInteractionTriggers(value as never);
          continue;
        }
        if (key === "eventSequence") {
          (level as Record<string, unknown>)[key] = normalizeEventSequence(value as never) ?? { byScenarioId: {} };
          continue;
        }
        if (key === "interactionArtifacts") {
          (level as Record<string, unknown>)[key] = normalizeInteractionArtifacts(value as never) ?? { byScenarioId: {} };
          continue;
        }
        if (key === "variants") {
          (level as Record<string, unknown>)[key] = normalizeLevelVariants({
            ...level,
            variants: value as Level["variants"],
          } as Level, "creator").variants;
          continue;
        }
        (level as Record<string, unknown>)[key] = value;
      }
      applyPointsThresholdsInPlace(level);
    },
  },
});

export const {
  updateCode,
  updateSolutionCode,
  snapshotCreatorCodes,
  resetAllLevelCodes,
  updateLevelPoints,
  updatePoints,
  updateAccuracy,
  evaluateLevel,
  updateWeek,
  resetLevel,
  startLevelTimer,
  startLevelTimerAt,
  toggleShowModelSolution,
  toggleImageInteractivity,
  toggleShowScenarioModel,
  toggleShowHotkeys,
  changeLevelDifficulty,
  changeAccuracyTreshold,
  updatePointsThresholds,
  changeScenarioDimensions,
  changeMaxPoints,
  addNewScenario,
  removeScenario,
  updateGuideSectionItem,
  updateGuideSectionTitle,
  removeGuideSection,
  removeGuideSectionItem,
  addGuideSection,
  addGuideSectionItem,
  handleLocking,
  updateLevelName,
  updateLevelEvents,
  clearEventSequenceForScenario,
  appendEventSequenceStep,
  updateEventSequenceStep,
  removeEventSequenceStep,
  clearInteractionArtifacts,
  recordVerifiedInteraction,
  addThisLevel,
  addNewLevel,
  removeLevel,
  updateLevelColors,
  updateLevelIdentifier,
  addLevelVariant,
  removeLevelVariantById,
  setActiveLevelVariant,
  setGuideSections,
  mergeRemoteLevelMeta,
} = levelsSlice.actions;

export default levelsSlice.reducer;
