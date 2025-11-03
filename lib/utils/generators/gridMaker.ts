/** @format */

import { drawBoardWidth, drawBoardheight } from "@/constants";
import { generator } from "@/types";

const propertiesAndValues = {
  display: ["block", "inline", "inline-block", "flex", "grid"],
  position: ["absolute", "relative", "fixed", "sticky"],
  width: [drawBoardWidth + "px", "100%", "50%"],
  height: [drawBoardheight + "px", "100%", "50%"],
  gap: ["2px", "10px", "20px"],
  "grid-template-columns": "grid-template-columns: ",
};

function generateGridAreasCSSString(
  selectors: string[],
  backgroundColors: string[]
) {
  let cssString = "";

  selectors.forEach((selector, index) => {
    cssString += `
      .${selector} {
        grid-area: ${selector};
        background-color: ${backgroundColors[index]};
      }
    `;
  });

  return cssString;
}

export const generateGridLevel: generator = () => {
  const columns = 3;
  const rows = 4;
  const colors = [
    "#7BDCB5",
    "#AB83A1",
    "#E1BC29",
    "#4A90E2",
    "#D667CD",
    "#FF6900",
    "#36D1DC",
  ];

  const secondaryColor = colors[colors.length - 1];

  const selectors = ["one", "two", "three", "four", "five", "six"];

  const gridMatrix = createRandomGrid(columns, rows, selectors);
  const anotherGridMatrix = createRandomGrid(columns, rows, selectors);
  const THTML = `<div class="wrapper">
  <div class="one">One</div>
  <div class="two">Two</div>
  <div class="three">Three</div>
  <div class="four">Four</div>
  <div class="five">Five</div>
  <div class="six">Six</div>
</div>`;
  const SHTML = THTML;
  const TCSS = `
#root {
  background-color: ${secondaryColor};
}
.wrapper {
	width: 100%;
	height: 100%;
  font-size: 1.2em;
}

`;
  const SCSS = `
#root {
  background-color: ${secondaryColor};
}

.wrapper {
  width: 100%;
  height: 100%;
  font-size: 1.2em;
	box-sizing: border-box;
  display: grid;
  gap: 2px;
  ${propertiesAndValues["grid-template-columns"]} repeat(${columns}, 1fr);
  grid-template-rows: repeat(${rows}, 1fr);
  grid-template-areas:
    "${gridMatrix[1][0]} ${gridMatrix[1][1]} ${gridMatrix[1][2]}"
    "${gridMatrix[2][0]} ${gridMatrix[2][1]} ${gridMatrix[2][2]}"
    "${gridMatrix[3][0]} ${gridMatrix[3][1]} ${gridMatrix[3][2]}"
    "${gridMatrix[4][0]} ${gridMatrix[4][1]} ${gridMatrix[4][2]}";
}

${generateGridAreasCSSString(selectors, colors)}

@media (min-height: 500px) {
  .wrapper {
    grid-template-areas:
      "${anotherGridMatrix[1][0]} ${anotherGridMatrix[1][1]} ${
    anotherGridMatrix[1][2]
  }"
      "${anotherGridMatrix[2][0]} ${anotherGridMatrix[2][1]} ${
    anotherGridMatrix[2][2]
  }"
      "${anotherGridMatrix[3][0]} ${anotherGridMatrix[3][1]} ${
    anotherGridMatrix[3][2]
  }"
      "${anotherGridMatrix[4][0]} ${anotherGridMatrix[4][1]} ${
    anotherGridMatrix[4][2]
  }";
  }
}

`;

  return {
    THTML,
    SHTML,
    TCSS,
    SCSS,
    lockCSS: false,
    lockHTML: true,
    lockJS: true,
    percentageTreshold: 90,
    percentageFullPointsTreshold: 98,
    colors: colors,
    difficulty: "hard",
    name: "Exam grid",
    instructions: [
      {
        title: "Task Overview:",
        content: [
          "In this exercise, you're provided with the HTML structure and CSS styling for a dynamic grid layout. Your task is to write the CSS necessary to dynamically populate the grid based on data provided in the CSS template.",
        ],
      },
      {
        title: "CSS Styling Objectives:",
        content: [
          "Understand how the grid layout is defined using CSS grid properties.",
          "Learn how to use grid-template-areas to define the layout of the grid cells.",
          "Practice using media queries to adjust the grid layout based on the viewport height.",
        ],
      },
      {
        title: "Key Concepts to Explore:",
        content: [
          "To complete your task, consider exploring the following CSS concepts:",
          "CSS grid properties like grid-template-columns, grid-template-rows, and grid-template-areas.",
          "Media queries for responsive layout adjustments based on viewport height.",
        ],
      },
    ],
    question_and_answer: {
      question: "NO QUESTION",
      answer: `NO ANSWER`,
    },
    scenarioDetails: [
      {
        width: 200,
        height: 300,
        id: "grid1",
      },
      {
        width: 300,
        height: 500,
        id: "grid2",
      },
    ],
  };
};
const createRandomGrid = (
  columns: number,
  rows: number,
  gridAreas: string[]
): { [key: number]: string[] } => {
  const gridMatrix: { [key: number]: string[] } = {
    1: [".", ".", "."],
    2: [".", ".", "."],
    3: [".", ".", "."],
    4: [".", ".", "."],
  };

  const availableMatrixIndexes: { [key: number]: number[] } = {
    1: [0, 1, 2],
    2: [0, 1, 2],
    3: [0, 1, 2],
    4: [0, 1, 2],
  };

  const availableRowIndexes: number[] = [1, 2, 3, 4];

  function isAvailable(
    row: number,
    col: number,
    direction: "top" | "right" | "bottom" | "left",
    availableRows: { [key: number]: number[] }
  ): boolean {
    const adjacentRow =
      direction === "top" ? row - 1 : direction === "bottom" ? row + 1 : row;
    const adjacentCol =
      direction === "left" ? col - 1 : direction === "right" ? col + 1 : col;
    return (
      availableRows[adjacentRow] &&
      availableRows[adjacentRow].includes(adjacentCol)
    );
  }

  const checkRow = (rowIndex: number): void => {
    const rowColumns = availableMatrixIndexes[rowIndex];

    if (rowColumns.length === 0) {
      delete availableMatrixIndexes[rowIndex];
      availableRowIndexes.splice(availableRowIndexes.indexOf(rowIndex), 1);
    }
  };

  const getRowColValue = (columns: number[], colIndex: number): number => {
    return columns.splice(colIndex, 1)[0];
  };

  gridAreas.forEach((area, index) => {
    const startRowNum =
      availableRowIndexes[
        Math.floor(Math.random() * availableRowIndexes.length)
      ];
    const availableColumns = availableMatrixIndexes[startRowNum];
    const colIndex = Math.floor(Math.random() * availableColumns.length);

    const startColumnNum = getRowColValue(availableColumns, colIndex);

    checkRow(startRowNum);

    let shouldExpand = Math.floor(Math.random() * 2) === 0 ? true : false;

    if (shouldExpand) {
      const directions: ("top" | "right" | "bottom" | "left")[] = [
        "top",
        "right",
        "bottom",
        "left",
      ];
      const availableDirections = directions.filter((dir) =>
        isAvailable(startRowNum, startColumnNum, dir, availableMatrixIndexes)
      );
      const direction =
        availableDirections[
          Math.floor(Math.random() * availableDirections.length)
        ];

      switch (direction) {
        case "top":
          gridMatrix[startRowNum - 1][startColumnNum] = area;
          // Remove the column from the available columns
          availableMatrixIndexes[startRowNum - 1].splice(startColumnNum, 1);
          checkRow(startRowNum - 1);
          break;
        case "right":
          gridMatrix[startRowNum][startColumnNum + 1] = area;
          availableMatrixIndexes[startRowNum].splice(startColumnNum + 1, 1);
          checkRow(startRowNum);
          break;
        case "bottom":
          gridMatrix[startRowNum + 1][startColumnNum] = area;
          availableMatrixIndexes[startRowNum + 1].splice(startColumnNum, 1);
          checkRow(startRowNum + 1);
          break;
        case "left":
          gridMatrix[startRowNum][startColumnNum - 1] = area;
          availableMatrixIndexes[startRowNum].splice(startColumnNum - 1, 1);
          checkRow(startRowNum);
          break;
      }
    }
    gridMatrix[startRowNum][startColumnNum] = area;
  });
  return gridMatrix;
};
