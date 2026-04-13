type question_and_answer = {
  question: string;
  answer: string;
};

type levelIdentifier = string;

export type NotificationRaw = {
  type: string;
  message: string;
};

export type Notification = {
  type: string;
  message: string;
  id: string;
};

export type scenario = {
  scenarioId: string;
  accuracy: number;
  dimensions: {
    width: number;
    height: number;
    unit?: string;
  };
  js: string;
};

export type difficulty = "easy" | "medium" | "hard";

export type InteractionEventType =
  | "click"
  | "change"
  | "input"
  | "submit"
  | "keydown";

export interface InteractionTrigger {
  id: string;
  eventType: InteractionEventType;
  selector?: string;
  keyFilter?: string;
  label?: string;
}

export interface VerifiedInteraction {
  id: string;
  triggerId: string;
  eventType: InteractionEventType;
  label?: string;
  selector?: string;
  targetSummary?: string;
  keyFilter?: string;
  keyPressed?: string;
  sequence: number;
  createdAt: string;
  preHash: string;
  postHash: string;
  verificationSource: "dom" | "pixel";
}

export interface InteractionArtifacts {
  byScenarioId: Record<string, VerifiedInteraction[]>;
}

export interface DrawboardSnapshotPayload {
  css: string;
  snapshotHtml: string;
  width: number;
  height: number;
}

export interface EventSequenceStep {
  id: string;
  scenarioId: string;
  order: number;
  eventType: InteractionEventType;
  showInTimeline?: boolean;
  selector?: string;
  keyFilter?: string;
  label: string;
  instruction: string;
  targetSummary?: string;
  verificationSource: "dom" | "pixel";
  preHash: string;
  postHash: string;
  snapshot: DrawboardSnapshotPayload;
}

export interface EventSequence {
  byScenarioId: Record<string, EventSequenceStep[]>;
}

type instructionSection = {
  title: string;
  content: string[];
};

export type scenarioAccuracy = {
  scenarioId: string;
  accuracy: number;
  /** When false, level mean from event-sequence aggregate is not currently valid (incomplete or stale steps). */
  meanAccuracyKnown?: boolean;
};

type instructions = instructionSection[];

export type PointsThreshold = {
  accuracy: number;
  pointsPercent: number;
};

export type LevelVariantContent = {
  buildingBlocks?: {
    pictures?: Array<string>;
    colors?: Array<string>;
  };
  code: {
    html: string;
    css: string;
    js: string;
  };
  solution: {
    html: string;
    css: string;
    js: string;
  };
  scenarios: scenario[];
  maxPoints: number;
  help: {
    description: string;
    images: string[];
    usefullCSSProperties: string[];
  };
  instructions: instructions;
  question_and_answer: question_and_answer;
  showModelPicture: boolean;
  lockCSS: boolean;
  lockHTML: boolean;
  lockJS: boolean;
  interactive: boolean;
  showScenarioModel: boolean;
  showHotkeys: boolean;
  eventSequence?: EventSequence;
  events: InteractionTrigger[];
  interactionArtifacts?: InteractionArtifacts;
  percentageTreshold: number;
  percentageFullPointsTreshold: number;
  pointsThresholds: PointsThreshold[];
  difficulty: difficulty;
};

export type LevelVariant = {
  id: string;
  name: string;
  content: LevelVariantContent;
};

export interface Level {
  identifier?: levelIdentifier;
  week: string;
  name: levelNames;
  difficulty: difficulty;
  completed: string;
  accuracy: number;
  buildingBlocks?: {
    pictures?: Array<string>;
    colors?: Array<string>;
  };
  code: {
    html: string;
    css: string;
    js: string;
  };
  solution: {
    html: string;
    css: string;
    js: string;
  };
  scenarios: scenario[];
  points: number;
  maxPoints: number;
  timeData: {
    startTime: number;
    pointAndTime: {
      [key: string]: string;
    };
  };
  help: {
    description: string;
    images: string[];
    usefullCSSProperties: string[];
  };
  confettiSprinkled: boolean;
  instructions: instructions;
  question_and_answer: question_and_answer;
  showModelPicture: boolean;
  lockCSS: boolean;
  lockHTML: boolean;
  lockJS: boolean;
  interactive: boolean;
  showScenarioModel: boolean;
  showHotkeys: boolean;
  eventSequence?: EventSequence;
  events: InteractionTrigger[];
  interactionArtifacts?: InteractionArtifacts;
  percentageTreshold: number;
  percentageFullPointsTreshold: number;
  pointsThresholds: PointsThreshold[];
  variants?: LevelVariant[];
  activeVariantId?: string;
  variantBase?: LevelVariantContent;
}

export type generator = () => {
  THTML: string;
  SHTML: string;
  TCSS: string;
  SCSS: string;
  TJS?: string;
  SJS?: string;
  events?: Array<string | InteractionTrigger>;
  instructions: instructions;
  question_and_answer: question_and_answer;
  difficulty: difficulty;
  name: levelNames;
  lockCSS: boolean;
  lockHTML: boolean;
  lockJS: boolean;
  percentageTreshold: number;
  percentageFullPointsTreshold: number;
  colors: string[];
  scenarioDetails: {
    width: number;
    height: number;
    js?: string;
    id?: string;
  }[];
};

export type LevelIdAndName = {
  // key is the id of the level, value is the name of the level
  [key: levelIdentifier]: string;
};

export type levelNames =
  | "template"
  | "Easy card"
  | "Medium form"
  | "Medium list"
  | "Easy table"
  | "test"
  | "test2"
  | "Easy flex"
  | "Hard flex"
  | "Easy grid"
  | "Hard grid"
  | "Hard form"
  | "Dynamic list"
  | "Medium Navbar"
  | "Easy sidebar"
  | "Exam flex"
  | "Exam grid";

export type MapDetails = {
  levels: levelIdentifier[];
  canUseAI: boolean;
  random: number;
};
