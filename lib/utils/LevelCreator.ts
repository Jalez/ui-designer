import { mainColor, secondaryColor } from "@/constants";
import { generator, levelNames, scenario } from "@/types";
import { cardGenerator } from "./generators/cardGenerator";
import { easyFlexGenerator } from "./generators/easyFlexGenerator";
import { easyGridGenerator } from "./generators/easyGridGenerator";
import { flexboxMaker } from "./generators/flexboxMaker";
import { formGenerator } from "./generators/formGenerator";
import { fullFormGenerator } from "./generators/fullFormGenerator";
import { generateGridLevel } from "./generators/gridMaker";
import { harderFlexGenerator } from "./generators/harderFlexGenerator";
import { harderGridGenerator } from "./generators/harderGridGenerator";
import { listGenerator } from "./generators/listGenerator";
import { DynamicListGenerator } from "./generators/listGeneratorDynamic";
import { ActiveNavbarGenerator } from "./generators/navbarGeneratorDynamicActive";
import { sidebarGenerator } from "./generators/sidebarGenerator";
import { tableGenerator } from "./generators/tableGenerator";
import { testGenerator } from "./generators/testGenerator";
import { testGenerator2 } from "./generators/testGenerator2";

const initialHtml: string = `<div></div>`;
const initialCss: string = `body {
	margin: 0px;
	background-color: ${secondaryColor};
}
div {
	width: 100px;
	height: 50px;
	background-color: ${mainColor};
}`;
const initialCode = {
  html: initialHtml,
  css: initialCss,
};

const initialDefaults = {
  week: "",
  completed: "no",
  // accuracy: "0",
  code: initialCode,
  points: 0,
  maxPoints: 5,
  // diff: "",
  // drawingUrl: "",
  // solutionUrl: "",
  // drawnEvalUrl: "",
  // solEvalUrl: "",
  solution: {
    html: "",
    css: "",
  },
  confettiSprinkled: false,
  instructions: "No instructions available",
  question_and_answer: {
    question: "No question available",
    answer: "No answer available",
  },
};

type generatorNameAndFunction = {
  [K in levelNames]: generator;
};

export const generatorNameAndFunction: generatorNameAndFunction = {
  test: testGenerator,
  test2: testGenerator2,
  "Easy card": cardGenerator,
  "Easy table": tableGenerator,
  "Easy sidebar": sidebarGenerator,
  "Easy flex": easyFlexGenerator,
  "Easy grid": easyGridGenerator,
  "Medium form": formGenerator,
  "Medium list": listGenerator,
  "Medium Navbar": ActiveNavbarGenerator,
  "Hard flex": harderFlexGenerator,
  "Hard grid": harderGridGenerator,
  "Hard form": fullFormGenerator,
  "Dynamic list": DynamicListGenerator,
  "Exam flex": flexboxMaker,
  "Exam grid": generateGridLevel,
  template: cardGenerator,
};
export type week =
  | "html_2_es"
  | "css_1_es"
  | "css_2_es"
  | "css_2"
  | "js_1_es"
  | "js_2_es"
  | "js_3_es"
  | "all"
  | "exam";

export const availableWeeks = [
  "test",
  "html_2_es",
  "css_1_es",
  "css_2_es",
  "css_2",
  "js_1_es",
  "js_2_es",
  "js_3_es",
  "exam",
];

export interface SolutionMap {
  [key: string]: {
    html: string;
    css: string;
    js?: string;
  };
}

export const createLevels = (
  week: week
): { levels: any[]; solutions: SolutionMap } | undefined => {
  const weekAndGenerators = {
    test: [testGenerator, testGenerator2],
    html_2_es: [cardGenerator, formGenerator],
    css_1_es: [listGenerator, tableGenerator],
    css_2: [easyFlexGenerator, easyGridGenerator],
    css_2_es: [harderFlexGenerator, harderGridGenerator], //TODO: Add more generators,
    js_1_es: [fullFormGenerator],
    js_2_es: [DynamicListGenerator],
    js_3_es: [ActiveNavbarGenerator],
    all: [
      cardGenerator,
      formGenerator,
      listGenerator,
      tableGenerator,
      easyFlexGenerator,
      easyGridGenerator,
      sidebarGenerator,
      harderFlexGenerator,
      harderGridGenerator,
      fullFormGenerator,
      DynamicListGenerator,
      ActiveNavbarGenerator,
    ],
    exam: [flexboxMaker, generateGridLevel],
  };
  const initialState = [];
  const initialSolutions: SolutionMap = {};
  const generators = weekAndGenerators[week] as generator[];
  if (!generators) return;

  let i = 0;
  // loop through the generators and create levels
  // const scenarioIds = ["Sauli", "Teppo", "Matti", "Mirjam"];
  for (const generator of generators) {
    i++;
    let randomLevel = {
      image: "",
      pictures: [],
    };
    // add grey as tertiary color
    const tertiaryColor = "#888";

    let generatedLevelDetails = generator();
    const { scenarioDetails } = generatedLevelDetails;

    const scenarios = [] as scenario[];
    //  go through the dimensions
    // const scenarioIds = ["Matti", "Teppo"];
    for (const details of scenarioDetails) {
      scenarios.push({
        scenarioId: details?.id || Math.random().toString(36).substring(7),
        // scenarioId: scenarioIds.pop() || "",
        // accuracy: 0,
        dimensions: {
          width: details.width,
          height: details.height,
        },
        js: details?.js || "",
      } as scenario);
    }
    const id = Math.random().toString(36).substring(7);

    const level = {
      identifier: id,
      name: generatedLevelDetails.name,
      scenarios: scenarios,
      buildingBlocks: {
        pictures: randomLevel.pictures,
        colors: generatedLevelDetails.colors,
      },
      ...initialDefaults,
      code: {
        html: generatedLevelDetails.THTML,
        css: generatedLevelDetails.TCSS,
        js: generatedLevelDetails?.TJS || "",
      },
      accuracy: 0,
      week: week,
      percentageTreshold: generatedLevelDetails.percentageTreshold,
      percentageFullPointsTreshold:
        generatedLevelDetails.percentageFullPointsTreshold,
      difficulty: generatedLevelDetails.difficulty,
      instructions: generatedLevelDetails.instructions,
      question_and_answer: generatedLevelDetails.question_and_answer,
      help: {
        description: "NO help available",
        images: [],
        usefullCSSProperties: [],
      },

      timeData: {
        startTime: 0,
        pointAndTime: {
          0: "0:0",
          1: "0:0",
          2: "0:0",
          3: "0:0",
          4: "0:0",
          5: "0:0",
        },
      },
      events: generatedLevelDetails?.events || [],
      interactive: false,
      showScenarioModel: true,
      showHotkeys: false,
      showModelPicture: true,
      lockCSS: generatedLevelDetails.lockCSS,
      lockHTML: generatedLevelDetails.lockHTML,
      lockJS: generatedLevelDetails.lockJS,
    };
    initialState.push(level);
    initialSolutions[level.name] = {
      html: generatedLevelDetails.SHTML,
      css: generatedLevelDetails.SCSS,
      js: generatedLevelDetails?.SJS || "",
    };
  }
  return {
    levels: initialState,
    solutions: initialSolutions,
  };
};
