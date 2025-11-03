/** @format */

import { generator } from "@/types";

export const testGenerator2: generator = () => {
  return {
    THTML: ``,
    SHTML: ``,
    TCSS: `#root {    
      margin: 0px;
      padding: 0px;
      overflow: hidden;
      position: relative; 
      background-color: #222;
    }`,
    SCSS: `
    #root {    
      margin: 0px;
      padding: 0px;
      overflow: hidden;
      position: relative; 
      background-color: #fff;
    }
  `,
    difficulty: "easy",
    name: "test2",
    instructions: [
      {
        title: "Requirements:",
        content: [`This level is only for testing css/html.`],
      },
    ],
    question_and_answer: {
      question: "What are lists in html?",
      answer: `Lists in HTML are used to present list of information in well formed and semantic way. There are three different types of lists in HTML and each one has a specific purpose and meaning. The three types of lists are: ordered list, unordered list, and definition list.`,
    },
    lockCSS: false,
    lockHTML: false,
    lockJS: false,
    percentageTreshold: 90,
    percentageFullPointsTreshold: 98,
    colors: ["#fff", "#000"],
    scenarioDetails: [
      {
        width: 250,
        height: 250,
        id: "test21",
      },
      {
        width: 300,
        height: 300,
        id: "test22",
      },
    ],
  };
};
