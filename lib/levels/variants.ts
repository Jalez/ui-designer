import type { Level } from "@/types";

export const BASE_LEVEL_VARIANT_ID = "base" as const;

export type LevelVariantSelection = string | typeof BASE_LEVEL_VARIANT_ID;

export type LevelVariantContent = {
  buildingBlocks?: Level["buildingBlocks"];
  code: Level["code"];
  solution: Level["solution"];
  scenarios: Level["scenarios"];
  maxPoints: Level["maxPoints"];
  help: Level["help"];
  instructions: Level["instructions"];
  question_and_answer: Level["question_and_answer"];
  showSolutionImageInsteadOfDiff: Level["showSolutionImageInsteadOfDiff"];
  lockCSS: Level["lockCSS"];
  lockHTML: Level["lockHTML"];
  lockJS: Level["lockJS"];
  interactive: Level["interactive"];
  showScenarioModel: Level["showScenarioModel"];
  showHotkeys: Level["showHotkeys"];
  eventSequence?: Level["eventSequence"];
  events: Level["events"];
  interactionArtifacts?: Level["interactionArtifacts"];
  percentageTreshold: Level["percentageTreshold"];
  percentageFullPointsTreshold: Level["percentageFullPointsTreshold"];
  pointsThresholds: Level["pointsThresholds"];
  difficulty: Level["difficulty"];
};

export type LevelVariant = {
  id: string;
  name: string;
  content: LevelVariantContent;
};

type LevelWithVariantRuntime = Level & {
  variants?: LevelVariant[];
  activeVariantId?: LevelVariantSelection;
  variantBase?: LevelVariantContent;
};

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Immer draft proxies cannot be structured-cloned; fall back to JSON cloning.
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createLevelVariantId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `variant-${Math.random().toString(36).slice(2, 10)}`;
}

export function getLevelVariantAssignmentKey(level: Pick<Level, "identifier">, levelIndex: number) {
  return typeof level.identifier === "string" && level.identifier.length > 0
    ? level.identifier
    : `index:${levelIndex}`;
}

export function extractLevelVariantContent(level: Level): LevelVariantContent {
  return cloneValue({
    buildingBlocks: level.buildingBlocks,
    code: level.code,
    solution: level.solution,
    scenarios: level.scenarios,
    maxPoints: level.maxPoints,
    help: level.help,
    instructions: level.instructions,
    question_and_answer: level.question_and_answer,
    showSolutionImageInsteadOfDiff: level.showSolutionImageInsteadOfDiff,
    lockCSS: level.lockCSS,
    lockHTML: level.lockHTML,
    lockJS: level.lockJS,
    interactive: level.interactive,
    showScenarioModel: level.showScenarioModel,
    showHotkeys: level.showHotkeys,
    eventSequence: level.eventSequence,
    events: level.events,
    interactionArtifacts: level.interactionArtifacts,
    percentageTreshold: level.percentageTreshold,
    percentageFullPointsTreshold: level.percentageFullPointsTreshold,
    pointsThresholds: level.pointsThresholds,
    difficulty: level.difficulty,
  });
}

export function applyLevelVariantContent(level: LevelWithVariantRuntime, content: LevelVariantContent) {
  level.buildingBlocks = cloneValue(content.buildingBlocks);
  level.code = cloneValue(content.code);
  level.solution = cloneValue(content.solution);
  level.scenarios = cloneValue(content.scenarios);
  level.maxPoints = content.maxPoints;
  level.help = cloneValue(content.help);
  level.instructions = cloneValue(content.instructions);
  level.question_and_answer = cloneValue(content.question_and_answer);
  level.showSolutionImageInsteadOfDiff = content.showSolutionImageInsteadOfDiff;
  level.lockCSS = content.lockCSS;
  level.lockHTML = content.lockHTML;
  level.lockJS = content.lockJS;
  level.interactive = content.interactive;
  level.showScenarioModel = content.showScenarioModel;
  level.showHotkeys = content.showHotkeys;
  level.eventSequence = cloneValue(content.eventSequence);
  level.events = cloneValue(content.events);
  level.interactionArtifacts = cloneValue(content.interactionArtifacts);
  level.percentageTreshold = content.percentageTreshold;
  level.percentageFullPointsTreshold = content.percentageFullPointsTreshold;
  level.pointsThresholds = cloneValue(content.pointsThresholds);
  level.difficulty = content.difficulty;
}

export function normalizeLevelVariants(level: Level, mode: "creator" | "game" = "creator"): LevelWithVariantRuntime {
  const nextLevel = level as LevelWithVariantRuntime;
  nextLevel.variants = Array.isArray(nextLevel.variants)
    ? nextLevel.variants.map((variant, index) => ({
        id: typeof variant?.id === "string" && variant.id.length > 0 ? variant.id : createLevelVariantId(),
        name: typeof variant?.name === "string" && variant.name.trim().length > 0
          ? variant.name.trim()
          : `Variant ${index + 1}`,
        content: cloneValue(
          variant?.content && typeof variant.content === "object"
            ? variant.content
            : extractLevelVariantContent(nextLevel),
        ),
      }))
    : [];

  if (mode === "creator") {
    nextLevel.variantBase = nextLevel.variantBase
      ? cloneValue(nextLevel.variantBase)
      : extractLevelVariantContent(nextLevel);
    nextLevel.activeVariantId =
      nextLevel.activeVariantId && nextLevel.activeVariantId !== BASE_LEVEL_VARIANT_ID
        ? nextLevel.activeVariantId
        : BASE_LEVEL_VARIANT_ID;
  } else {
    nextLevel.variantBase = extractLevelVariantContent(nextLevel);
    nextLevel.activeVariantId = BASE_LEVEL_VARIANT_ID;
  }

  return nextLevel;
}

export function syncActiveVariantIntoLevel(level: LevelWithVariantRuntime) {
  const activeVariantId = level.activeVariantId ?? BASE_LEVEL_VARIANT_ID;
  const snapshot = extractLevelVariantContent(level);

  if (activeVariantId === BASE_LEVEL_VARIANT_ID) {
    level.variantBase = snapshot;
    return;
  }

  if (!level.variantBase) {
    level.variantBase = snapshot;
  }

  const variant = level.variants?.find((entry) => entry.id === activeVariantId);
  if (variant) {
    variant.content = snapshot;
  }
}

export function setLevelVariantView(level: LevelWithVariantRuntime, variantId: LevelVariantSelection) {
  syncActiveVariantIntoLevel(level);

  if (variantId === BASE_LEVEL_VARIANT_ID) {
    applyLevelVariantContent(level, level.variantBase ?? extractLevelVariantContent(level));
    level.activeVariantId = BASE_LEVEL_VARIANT_ID;
    return;
  }

  const targetVariant = level.variants?.find((variant) => variant.id === variantId);
  if (!targetVariant) {
    return;
  }

  applyLevelVariantContent(level, targetVariant.content);
  level.activeVariantId = targetVariant.id;
}

export function addLevelVariantFromCurrentView(level: LevelWithVariantRuntime) {
  syncActiveVariantIntoLevel(level);

  const nextIndex = (level.variants?.length ?? 0) + 1;
  const variant: LevelVariant = {
    id: createLevelVariantId(),
    name: `Variant ${nextIndex}`,
    content: extractLevelVariantContent(level),
  };

  if (!Array.isArray(level.variants)) {
    level.variants = [];
  }
  level.variants.push(variant);
  level.activeVariantId = variant.id;
}

export function removeLevelVariant(level: LevelWithVariantRuntime, variantId: string) {
  if (!Array.isArray(level.variants) || !variantId) {
    return;
  }

  syncActiveVariantIntoLevel(level);
  level.variants = level.variants.filter((variant) => variant.id !== variantId);
  if (level.activeVariantId === variantId) {
    applyLevelVariantContent(level, level.variantBase ?? extractLevelVariantContent(level));
    level.activeVariantId = BASE_LEVEL_VARIANT_ID;
  }
}

export function serializeLevelForPersistence(level: Level): Level {
  const cloned = cloneValue(level) as LevelWithVariantRuntime;
  normalizeLevelVariants(cloned, "creator");
  syncActiveVariantIntoLevel(cloned);
  applyLevelVariantContent(cloned, cloned.variantBase ?? extractLevelVariantContent(cloned));
  delete cloned.activeVariantId;
  delete cloned.variantBase;
  return cloned;
}

export function applyAssignedVariantToLevel(level: Level, assignedVariantId: string | undefined): Level {
  const nextLevel = normalizeLevelVariants(cloneValue(level), "game");
  if (!assignedVariantId || assignedVariantId === BASE_LEVEL_VARIANT_ID) {
    return nextLevel;
  }

  const variant = nextLevel.variants?.find((entry) => entry.id === assignedVariantId);
  if (!variant) {
    return nextLevel;
  }

  applyLevelVariantContent(nextLevel, variant.content);
  nextLevel.variantBase = extractLevelVariantContent(nextLevel);
  nextLevel.activeVariantId = BASE_LEVEL_VARIANT_ID;
  return nextLevel;
}
