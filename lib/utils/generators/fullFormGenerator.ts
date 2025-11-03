/** @format */

import { drawBoardWidth, drawBoardheight } from "@/constants";
import { generator } from "@/types";

const inputTypes = ["text", "email", "password", "number", "date"];
const labelTextDecorations = ["underline", "underline overline", "overline "];
const buttonTypes = ["submit"];
const formStyles = ["solid", "outlined", "rounded", "minimal"];

export const fullFormGenerator: generator = () => {
  const primaryColor = "#496989";
  const secondaryColor = "#58A399";
  // Determine the current time and assign indexes based on time intervals
  const currentTime = new Date();
  const hour = currentTime.getHours();
  const timeIndex = Math.floor(hour / 2);

  // Select content based on time index
  const selectedInputType = inputTypes[timeIndex % inputTypes.length];

  const selectedLabelDecoration =
    labelTextDecorations[timeIndex % labelTextDecorations.length];
  const selectedButtonType = buttonTypes[timeIndex % buttonTypes.length];
  const selectedFormStyle = formStyles[timeIndex % formStyles.length];
  const instructions = [
    {
      title: "Requirements:",
      content: [
        "You need to modify both the HTML and CSS to create a form layout.",
        "Use the given custom variables for paddings and margins, and colors.",
        "Submit the finished form before the end of the exercise session.",
      ],
    },
    {
      title: "Exploration Suggestions:",
      content: [
        ":root : look into what it does and how variables can be used in CSS.",
        "Experiment with different form elements and their attributes.",
      ],
    },
    {
      title: "Additional Guidelines:",
      content: [
        "When in need of help, ask.",
        "If group work: Work together as a group to solve this exercise. ",
      ],
    },
  ];

  const question_and_answer = {
    question: "What are forms in html?",
    answer: `HTML forms are used to collect user input. They contain form elements like text fields, checkboxes, radio buttons, submit buttons, etc. Users enter data into these elements, and the data is sent to a server for processing.  `,
  };

  const colors = [
    "#496989",
    "#58A399",
    primaryColor, //#fff
    secondaryColor, //#222
  ];

  const html = `<form>
  <h2>Contact Us</h2>
  <input type="text" placeholder="Name">
  <input type="email" placeholder="Email">
  <textarea placeholder="Your Message"></textarea>
  <button type="submit">Send</button>
</form>
`;

  const css = `
  :root {
    --primary-color: #496989;
    --secondary-color: #58A399;
    --text-color: #fff;
    --margin: 1em;
    --padding: 1em;  
  }
  
  #root {
      font-family: Arial, sans-serif;
      background-color: var(--secondary-color);
      color: var(--text-color);
  } 
  
  form {
      background-color: var(--primary-color);
    display: flex; 
    flex-direction: column; 
    margin: var(--margin);
    padding: var(--padding);
  }
  
  h2 {
      text-align: center;
    
  }
  
  input, textarea {
    margin: var(--margin)
  }
  
  button {
      background-color: var(--primary-color);
      color: var(--text-color);
      border: none;
  }
`;

  const TCSS = `
  :root {
    --primary-color: #496989;
    --secondary-color: #58A399;
    --text-color: #fff;
    --margin: 1em;
    --padding: 1em;  
  }
  
  #root {
      font-family: Arial, sans-serif;
      background-color: var(--secondary-color);
      color: var(--text-color);
  } 
  
   `;
  const THTML = `<form>Add your form elements here</form>`;

  return {
    THTML,
    SHTML: html,
    TCSS: TCSS,
    SCSS: css,
    difficulty: "hard",
    name: "Hard form",
    instructions,
    question_and_answer,
    lockCSS: false,
    lockHTML: false,
    lockJS: true,
    percentageTreshold: 95,
    percentageFullPointsTreshold: 99,
    colors: colors,
    scenarioDetails: [
      {
        id: "hardForm1",
        width: drawBoardWidth,
        height: drawBoardheight,
      },
    ],
  };
};
