/** @format */

// import { drawBoardWidth, drawBoardheight } from "../../constants";
import { generator } from "@/types";

const justifyContent = [
  "justify-content:flex-start",
  "justify-content:flex-end",
  "justify-content:center",
  "justify-content:space-between",
  "justify-content:space-around",
  "justify-content:space-evenly",
];
const alignItems = [
  "align-items:flex-start",
  "align-items:flex-end",
  "align-items:center",
  "align-items:stretch",
  "align-items:baseline",
];
const alignContent = [
  "align-content:flex-start",
  "align-content:flex-end",
  "align-content:center",
  "align-content:space-between",
  "align-content:space-around",
  "align-content:stretch",
];
const flexWrap = ["flex-wrap:wrap", "flex-wrap:wrap-reverse"];
const flexDirection = [
  "flex-direction:row",
  "flex-direction:row-reverse",
  "flex-direction:column",
  "flex-direction:column-reverse",
];

const flex = ["flex:1"];

export const flexboxMaker: generator = () => {
  const drawBoardWidth = 300;
  const drawBoardheight = 200;
  const primaryColor = "#f1f1f1";
  const secondaryColor = "#333";
  const randomJustifyContent =
    justifyContent[Math.floor(Math.random() * justifyContent.length)].split(
      ":"
    )[1];
  const randomAlignItems =
    alignItems[Math.floor(Math.random() * alignItems.length)].split(":")[1];
  const randomAlignContent =
    alignContent[Math.floor(Math.random() * alignContent.length)].split(":")[1];
  const randomFlexWrap =
    flexWrap[Math.floor(Math.random() * flexWrap.length)].split(":")[1];
  const randomFlexDirection =
    flexDirection[Math.floor(Math.random() * flexDirection.length)].split(
      ":"
    )[1];

  const html = `<div class="wrapper">
  <div class="one">One</div>
  <div class="two">Two</div>
  <div class="three">Three</div>
  <div class="four">Four</div>
  <div class="five">Five</div>
  <div class="six">Six</div>
</div>`;

  const tcss = `
:root {
  --element-gap: 1em;
}
  
#root {
  height: ${drawBoardheight}px;
  width: ${drawBoardWidth}px;
  margin: 0;
  padding: 0;
  background-color: ${secondaryColor};
}

div>div {
  background-color: ${primaryColor};
  font-size: 1.2em;
  vertical-align: middle;
  text-align: center;
  padding: 0.5em;
  border-radius: 5px;
  min-width: fit-content; 
}

	`;
  const scss = `

${tcss}
.wrapper {
	height: ${drawBoardheight}px;
	width: ${drawBoardWidth}px;
display: flex;
flex-wrap: ${randomFlexWrap};
justify-content: ${randomJustifyContent};
flex-direction: ${randomFlexDirection};
align-items: ${randomAlignItems};
align-content: ${randomAlignContent};
gap: 1em; 
}
div>div {
	${flex[Math.floor(Math.random() * flex.length)]};
  flex: 1;
}
`;
  const THTML = html;
  const SHTML = html;
  return {
    THTML,
    SHTML,
    SCSS: scss + "\n" + tcss,
    TCSS: tcss,
    lockCSS: false,
    lockHTML: true,
    lockJS: true,
    percentageTreshold: 90,
    percentageFullPointsTreshold: 98,
    colors: [primaryColor, secondaryColor],
    difficulty: "hard",
    name: "Exam flex",
    instructions: [
      {
        title: "Task Overview:",
        content: [
          "In this exercise, you are provided with CSS styling for a dynamic list. Your task is to write the CSS necessary to dynamically populate the list based on data provided in the template.",
        ],
      },
      {
        title: "CSS Objectives:",
        content: [
          "Understand the provided CSS styling for the list and how it affects the layout and appearance of the elements.",
          "Learn to identify the classes and IDs used in the CSS and how they correspond to the HTML structure.",
        ],
      },
      {
        title: "Key Concepts to Explore:",
        content: [
          "To complete your task, consider exploring the following CSS concepts:",
          "Flexbox properties like flex-wrap, justify-content, flex-direction, align-items, and align-content.",
          "Pseudo-elements and their usage in styling elements.",
        ],
      },
    ],
    question_and_answer: {
      question: "Create a flexbox layout",
      answer: "display:flex",
    },
    scenarioDetails: [
      {
        id: "flex1",
        width: drawBoardWidth,
        height: drawBoardheight,
      },
    ],
  };
};
