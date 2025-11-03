/** @format */

import { generator } from "@/types";

const listItems = ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"];
const listStyles = ["bullet", "numbered", "interactive", "minimal"];
const listColors = ["red", "blue", "green", "purple", "orange"];

export const harderGridGenerator: generator = () => {
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
        "Utilize CSS Grid for the layout, specifically focusing on 'grid-template-columns' and 'grid-template-rows'.",
        "Ensure all measurements for padding, margins, and font sizes are in 'pixels'.",
        "Stick to the limited color palette as defined (e.g., #55d4eb, #d5c9e2, etc.).",
      ],
    },
    {
      title: "Exploration Suggestions:",
      content: [
        "To master CSS Grid layout, here are some resources and keywords for your research:",
        "Explore 'CSS Grid Layout' on platforms like MDN Web Docs or CSS-Tricks for detailed guides and examples.",
        "Investigate 'CSS grid-gap' to understand spacing within grid layouts.",
        "Look into 'CSS fr unit' for understanding fractional units in grid layouts.",
      ],
    },
    {
      title: "Additional Guidelines:",
      content: [
        "Feel free to experiment with grid item placement, not just sticking to the example solution's selectors.",
        "Experiment with styling individual grid items (like .hero, .sidebar) within the specified color and size constraints.",
      ],
    },
  ];
  const question_and_answer = {
    question: "What is the purpose of grid in css?",
    answer: `The CSS Grid Layout Module offers a grid-based layout system, with rows and columns, making it easier to design web pages without having to use floats and positioning. `,
  };

  const html = `
  <section class="container">
    <header class="header">Header</header>
    <main class="hero">Hero</main>
    <aside class="sidebar">Sidebar</aside>
    <section class="content">Main Content</section>
    <section class="extra">Extra Content</section>
  </section>
`;

  const TCSS = `
#root {
    text-align: center;
    margin: 0;
    background-color: ${bgColor};
    color: ${textColor};
    }
`;

  const css = `
  ${TCSS}

  .container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 50px 1fr 1fr;
    grid-gap: 5px;
    height: 100%;
  }
  
  .header {
    grid-column: 1 / 3;
    grid-row: 1 / 2;
    background-color: ${colors[0]};
  }
  
  .hero {
    grid-column: 1 / 2;
    grid-row: 2 / 3;
    background-color: ${colors[1]};
  }
  
  .sidebar {
    grid-column: 2 / 3;
    grid-row: 2 / 4;
    background-color: ${colors[2]};
  }
  
  .content {
    grid-column: 1 / 2;
    grid-row: 3 / 4;
    background-color: ${colors[3]};
  }
  
  .extra {
    grid-column: 1 / 2;
    grid-row: 4 / 5;
    background-color: ${colors[4]};
  }

  @media (max-width: 200px) {
    .container {
      grid-template-columns: 1fr;
      grid-template-rows: 50px 1fr 1fr 1fr;
    }

    .header {
      grid-column: 1 / 2;
      grid-row: 1 / 2;
    }

    .hero {
      grid-column: 1 / 2;
      grid-row: 2 / 3;
    }

    .sidebar {
      grid-column: 1 / 2;
      grid-row: 3 / 4;
    }

    .content {
      grid-column: 1 / 2;
      grid-row: 4 / 5;
    }

    .extra {
      grid-column: 1 / 2;
      grid-row: 5 / 6;
    }
  }
`;

  return {
    THTML: html,
    SHTML: html,
    TCSS: TCSS,
    SCSS: css,
    difficulty: "hard",
    name: "Hard grid",
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
        id: "hardGrid1",
      },
      {
        width: 200,
        height: 500,
        id: "hardGrid2",
      },
    ],
  };
};
