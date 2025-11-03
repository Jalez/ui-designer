/** @format */

import { generator } from "@/types";

const listItems = ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"];
const listStyles = ["bullet", "numbered", "interactive", "minimal"];
const listColors = ["red", "blue", "green", "purple", "orange"];

export const harderFlexGenerator: generator = () => {
  const bgColor = "#f9f9f9";
  const textColor = "#333";
  const colors = [
    "#496989",
    "#58A399",
    "#A8CD9F",
    "#E2F4C5",
    "#F4A896",
    bgColor,
    textColor,
  ];

  const instructions = [
    {
      title: "Requirements:",
      content: [
        "Utilize CSS Flexbox for the layout, specifically focusing on 'flex-direction', and flex property.",
        "You shouldnt need to use very many, if any, units of measurement for this exercise. Flexbox is designed to be flexible and responsive without needing to specify exact measurements.",
        "You may need to use media queries to make the layout responsive.",
      ],
    },
    {
      title: "Exploration Suggestions:",
      content: [
        "To improve your CSS Flexbox skills, consider the following:",
        "Explore resources like MDN Web Docs or CSS-Tricks for detailed guides and examples on CSS Flexbox.",
        "Investigate the 'flex' property to understand how it can be used to control the size of flex items.",
        "Experiment with 'flex-direction' to change the direction of the flex container's main axis.",
        "For media queries, consider using the 'min-width' property to make the layout responsive.",
      ],
    },
  ];

  const question_and_answer = {
    question: "What is the purpose of flex in css?",
    answer: `Flexbox is a layout model in CSS that allows you to design complex layouts more easily and efficiently. It provides a more efficient way to align and distribute space among items in a container, even when their size is unknown or dynamic. Flexbox is particularly useful for creating responsive designs and complex layouts that are difficult to achieve with traditional CSS methods.`,
  };

  const html = `<div class="container">
  <div class="box" style="background-color: #496989;">A</div>
  <div class="box" style="background-color: #58A399;">B</div>
  <div class="box" style="background-color: #A8CD9F;">C</div>
  <div class="box" style="background-color: #E2F4C5;">D</div>
  <div class="box" style="background-color: #F4A896;">E</div>
</div>

`;
  const TCSS = `
#root {
    margin: 0;
    background-color: ${bgColor};
    color: ${textColor};
    }
`;

  const css = `${TCSS}

.container {
  display: flex;
  flex-direction: column; 
  height: 80%; 
}

.box {
  flex: 1; 
}

@media (min-width: 400px) {
  .container {
    flex-direction: row;
    height: 100%; 
    width: 80%; 
  }
}
`;

  return {
    THTML: html,
    SHTML: html,
    TCSS: TCSS,
    SCSS: css,
    difficulty: "hard",
    name: "Hard flex",
    instructions,
    question_and_answer,
    lockCSS: false,
    lockHTML: true,
    lockJS: true,
    percentageTreshold: 90,
    percentageFullPointsTreshold: 98,
    colors: colors,
    scenarioDetails: [
      {
        width: 500,
        height: 200,
        id: "hardFlex1"
      },
      {
        width: 200,
        height: 500,
        id: "hardFlex2"
      },
    ],
  };
};
