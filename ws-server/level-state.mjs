export function mergeTemplateAndProgressLevels(templateLevels = [], progressLevels = []) {
  const mergedLevels = [];
  const maxLevelCount = Math.max(templateLevels.length, progressLevels.length);

  for (let levelIndex = 0; levelIndex < maxLevelCount; levelIndex += 1) {
    const templateLevel = templateLevels[levelIndex];
    const progressLevel = progressLevels[levelIndex];

    if (templateLevel && progressLevel && typeof progressLevel === "object") {
      const templateCode =
        templateLevel.code && typeof templateLevel.code === "object" ? templateLevel.code : {};
      const progressCode =
        progressLevel.code && typeof progressLevel.code === "object" ? progressLevel.code : {};

      mergedLevels.push({
        ...templateLevel,
        ...progressLevel,
        name:
          typeof progressLevel.name === "string" && progressLevel.name.length > 0
            ? progressLevel.name
            : templateLevel.name,
        code: {
          html:
            typeof progressCode.html === "string"
              ? progressCode.html
              : (typeof templateCode.html === "string" ? templateCode.html : ""),
          css:
            typeof progressCode.css === "string"
              ? progressCode.css
              : (typeof templateCode.css === "string" ? templateCode.css : ""),
          js:
            typeof progressCode.js === "string"
              ? progressCode.js
              : (typeof templateCode.js === "string" ? templateCode.js : ""),
        },
      });
      continue;
    }

    if (templateLevel) {
      mergedLevels.push(templateLevel);
      continue;
    }

    if (progressLevel && typeof progressLevel === "object") {
      mergedLevels.push(progressLevel);
    }
  }

  return mergedLevels;
}

export function createStarterLevel(mapName = "") {
  return {
    name: "template",
    scenarios: [],
    buildingBlocks: { pictures: [], colors: [] },
    code: { html: "", css: "", js: "" },
    solution: { html: "", css: "", js: "" },
    accuracy: 0,
    week: mapName,
    percentageTreshold: 70,
    percentageFullPointsTreshold: 95,
    pointsThresholds: [
      { accuracy: 70, pointsPercent: 25 },
      { accuracy: 85, pointsPercent: 60 },
      { accuracy: 95, pointsPercent: 100 },
    ],
    difficulty: "easy",
    instructions: [],
    question_and_answer: { question: "", answer: "" },
    help: { description: "Start coding!", images: [], usefullCSSProperties: [] },
    timeData: { startTime: 0, pointAndTime: { 0: "0:0", 1: "0:0", 2: "0:0", 3: "0:0", 4: "0:0", 5: "0:0" } },
    events: [],
    interactive: false,
    showScenarioModel: true,
    showHotkeys: false,
    showSolutionImageInsteadOfDiff: true,
    lockCSS: false,
    lockHTML: false,
    lockJS: false,
    completed: "",
    points: 0,
    maxPoints: 100,
    confettiSprinkled: false,
  };
}

export function createVersionMap(source = {}) {
  return {
    html: Number.isFinite(source?.html) ? source.html : 0,
    css: Number.isFinite(source?.css) ? source.css : 0,
    js: Number.isFinite(source?.js) ? source.js : 0,
  };
}

export function createLevelState(level = {}) {
  const { name = "", code = {}, versions = {}, ...meta } = level || {};
  // Ensure scenarios and buildingBlocks always exist so the creator UI
  // can add/remove items without guarding against undefined.
  if (!Array.isArray(meta.scenarios)) {
    meta.scenarios = [];
  }
  if (!meta.buildingBlocks || typeof meta.buildingBlocks !== "object" || Array.isArray(meta.buildingBlocks)) {
    meta.buildingBlocks = { pictures: [], colors: [] };
  }
  return {
    name: typeof name === "string" ? name : "",
    code: {
      html: typeof code?.html === "string" ? code.html : "",
      css: typeof code?.css === "string" ? code.css : "",
      js: typeof code?.js === "string" ? code.js : "",
    },
    versions: createVersionMap(versions),
    meta,
  };
}

export function serializeLevelState(level) {
  return {
    ...level.meta,
    name: level.name,
    code: {
      html: level.code.html,
      css: level.code.css,
      js: level.code.js,
    },
  };
}

export function createRoomState(ctx, progressData, options = {}) {
  const { templateLevels = [], mapName = "", instanceId = null } = options;
  const normalizedProgressData =
    progressData && typeof progressData === "object" && !Array.isArray(progressData)
      ? { ...progressData }
      : {};
  const levels = Array.isArray(normalizedProgressData.levels)
    ? normalizedProgressData.levels.map((level) => createLevelState(level))
    : [];
  const normalizedTemplateLevels = Array.isArray(templateLevels)
    ? templateLevels.map((level) => serializeLevelState(createLevelState(level)))
    : [];

  return {
    ctx,
    progressData: normalizedProgressData,
    levels,
    templateLevels: normalizedTemplateLevels,
    mapName: typeof mapName === "string" ? mapName : "",
    instanceId: typeof instanceId === "string" ? instanceId : null,
  };
}

export function ensureLevelState(state, levelIndex) {
  if (!state.levels[levelIndex]) {
    state.levels[levelIndex] = createLevelState();
  }
  return state.levels[levelIndex];
}

export function serializeProgressData(state) {
  return {
    ...state.progressData,
    levels: state.levels.map((level) => serializeLevelState(level)),
  };
}
