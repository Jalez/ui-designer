/** @format */

import { generator } from "@/types";

const listItems = ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"];
const listStyles = ["bullet", "numbered", "interactive", "minimal"];
const listColors = ["red", "blue", "green", "purple", "orange"];

export const easyFlexGenerator: generator = () => {
  const primaryColor = "#f9f9f9";
  const secondaryColor = "#333";

  const bgColor = primaryColor;
  const textColor = secondaryColor;
  const colors = [
    "#496989",
    "#58A399",
    "#A8CD9F",
    "#E2F4C5",
    "#F4A896",
    primaryColor,
    secondaryColor,
  ];

  const instructions = [
    {
      title: "Requirements:",
      content: [
        "Utilize CSS Flexbox for the layout, specifically focusing on 'display', 'flex-direction', and 'justify-content'.",
        "Ensure all measurements for padding, margins, and font sizes are in 'pixels'.",
        "Experiment with different color combinations using the provided color palette.",
      ],
    },
    {
      title: "Exploration Suggestions:",
      content: [
        "Explore resources like MDN Web Docs or CSS-Tricks for detailed guides and examples on CSS Flexbox.",
        "Investigate the 'flex-wrap' property to understand wrapping behavior in flex layouts.",
        "Experiment with 'flex-grow' and 'flex-shrink' to control item growth and shrinking in flex layouts.",
      ],
    },
    {
      title: "Additional Guidelines:",
      content: [
        "Feel free to experiment with flex item placement, not just sticking to the example solution's selectors.",
        "Try styling individual flex items (e.g., header, main, aside) within the specified color and size constraints.",
      ],
    },
  ];

  const question_and_answer = {
    question: "What is the purpose of flex in css?",
    answer: `Flexbox is a layout model in CSS that allows you to design complex layouts more easily and efficiently. It provides a more efficient way to align and distribute space among items in a container, even when their size is unknown or dynamic. Flexbox is particularly useful for creating responsive designs and complex layouts that are difficult to achieve with traditional CSS methods.`,
  };

  const html = `
  <header></header>
  <main>
      <section></section>
      <aside></aside>
  </main>
  <footer></footer>

`;
  const TCSS = `
#root {
    margin: 0;
    background-color: ${bgColor};
    color: ${textColor};
    }
`;

  const css = `${TCSS}

header, footer {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50px;
  background-color: ${colors[0]};
}

main {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: start;
  height: calc(100% - 100px);
  background-color: ${colors[1]};
}

section {
  background-color: ${colors[2]}; 
  width: 30%; 
  height: 100%;
}

aside {
  background-color: ${colors[3]};
  height: 100%;
width: 20%; 
}
`;

  return {
    THTML: html,
    SHTML: html,
    TCSS: TCSS,
    SCSS: css,
    difficulty: "easy",
    name: "Easy flex",
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
        width: 400,
        height: 300,
        id: "easyFlex1",
      },
    ],
  };
};
