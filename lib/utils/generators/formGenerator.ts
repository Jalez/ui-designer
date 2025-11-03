/** @format */

import { drawBoardWidth, drawBoardheight } from "@/constants";
import { generator } from "@/types";

const inputTypes = ["text", "email", "password", "number", "date"];
const labelTextDecorations = ["underline", "underline overline", "overline "];
const buttonTypes = ["submit"];
const formStyles = ["solid", "outlined", "rounded", "minimal"];

export const formGenerator: generator = () => {
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
        `Create a form that uses the ${selectedFormStyle} class, with a ${selectedInputType} input, a checkbox inside a fieldset and a ${selectedButtonType} button. The form should have a label for the input, and the label should have inline styling for ${selectedLabelDecoration}. For parent elements that need their children to be on the same row, you can use the same-row-children class. You must use the correct class names, ids and semantic tags to style the form and its content. For instance, the semantic tags "form", "label", "input" and "button" should be present. header, section and footer should be used. If Ids are required, Id is the same as the type of the element. You can look at the stylesheet and provided picture for reference.`,
      ],
    },
  ];

  const question_and_answer = {
    question: "What are forms in html?",
    answer: `HTML forms are used to collect user input. They contain form elements like text fields, checkboxes, radio buttons, submit buttons, etc. Users enter data into these elements, and the data is sent to a server for processing.  `,
  };

  // Generate HTML for the selected input type

  // Generate CSS for the selected input type

  const html = `<form class="custom-form ${selectedFormStyle}">
  <header>
  <h1>Form title</h1>
  </header>
  <section>
  <div class="same-row-children">
  <label for="${selectedInputType}" style="text-decoration: ${selectedLabelDecoration};">${
    selectedInputType.charAt(0).toUpperCase() +
    selectedInputType.slice(1) +
    " label"
  }</label>
  <input type="${selectedInputType}" id="${selectedInputType}" name="${selectedInputType}" placeholder="Enter ${selectedInputType}">
  </div>
  <fieldset>
      <legend>Remember input?</legend>
      <div
      class="same-row-children"
      >
      <input type="checkbox" id="scales" name="scales" checked />
      <label for="scales">Remember</label>
      </div>
      </fieldset>
      </section>
    <footer>
    
    <button type="${selectedButtonType}">${
    selectedButtonType.charAt(0).toUpperCase() + selectedButtonType.slice(1)
  }</button>
    </footer>
</form>
`;

  const css = `


#root {    
  margin: 0px;
  padding: 0px;
  overflow: hidden;
  background-color: ${secondaryColor};
  color: ${primaryColor};
}

.same-row-children {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

section {
  margin-top: 20px
}

footer {
  margin-top: 40px;
}

fieldset {
  margin-top: 30px;
}


form input {
  display: block;
  border: 1px solid ${primaryColor};
  border-radius: 5px;
}

input[type="text"] {
  background-color: ${primaryColor};
  color: ${secondaryColor};
  border: 2px solid ${secondaryColor}; 
  border-radius: 5px; /* Slight rounding of corners */
  padding: 5px; /* Adds some padding inside the input */
}

input[type="email"] {
  background-color: ${secondaryColor};
  color: ${primaryColor};
  border: 2px dashed ${primaryColor}; /* Dashed border for distinction */
  border-radius: 10px; /* Keeps the original border-radius */
  padding: 8px; /* Slightly more padding */
}

input[type="password"] {
  background-color: ${secondaryColor};
  color: ${primaryColor};
  border: 3px double ${primaryColor}; /* Double border for a unique look */
  border-radius: 0; /* No border-radius */
  padding: 5px;
  box-shadow: 0px 2px 4px ${primaryColor}; /* Adds a shadow for depth */
}

input[type="number"] {
  background-color: ${primaryColor};
  color: ${secondaryColor};
  border: none; /* No border */
  border-radius: 15px; /* Increased border-radius */
  padding: 5px;
  box-shadow: 0px -2px 4px ${secondaryColor}; /* Shadow for a lifted effect */
}

input[type="checkbox"] {
  appearance: none;
  background-color: ${primaryColor};
  margin: 0;
  font: inherit;
  color: currentColor;
  width: 1.15em;
  height: 1.15em;
  border: 0.15em solid currentColor;
  border-radius: 0.15em;
  transform: translateY(-0.075em);
  display: grid;
  place-content: center;
}

input[type="checkbox"]::before {
  content: "";
  width: 0.65em;
  height: 0.65em;
  transform: scale(0);
  transition: 120ms transform ease-in-out;
  box-shadow: inset 1em 1em ${secondaryColor};
  /* Windows High Contrast Mode */
  background-color: CanvasText;
  transform-origin: bottom left;
  clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
}

input[type="checkbox"]:checked::before {
  transform: scale(1);
}


.solid {
  background-color: ${primaryColor};
  color: ${secondaryColor};
}

.outlined {
  border: 2px solid ${primaryColor};
  background-color: transparent;
  color: ${primaryColor};
}

.rounded {
  background-color: ${primaryColor};
  color: ${secondaryColor};
  border-radius: 10px;
}

.minimal {
  background-color: transparent;
  color: ${primaryColor};
}



header h1,
header h2,
header h3,
header h4,
header h5,
header h6 {
    margin: 0;
    padding-bottom: 10px;
    font-size: 25px;
    font-weight: normal;  
}

form {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: ${primaryColor};
  color: ${secondaryColor};
  margin: 10px;
  padding: 10px;
}


form label {
  margin-bottom: 5px;
}

/* Styles for label of text input */
form label[for="text"] {
  ${(selectedInputType !== "text" && "background-color:  #f00;") || ""}
  margin-bottom: 5px;
  font-weight: bold; /* Bold text */
}

/* Styles for label of email input */
form label[for="email"] {
  ${(selectedInputType !== "email" && "background-color:  #f00;") || ""}
  margin-left: 5px;
}

/* Styles for label of password input */
form label[for="password"] {
  ${(selectedInputType !== "password" && "background-color:  #f00;") || ""}
  margin-right: 5px;
  font-style: italic; /* Italic text for password label */
  text-transform: uppercase; /* Uppercase text */
}

/* Styles for label of number input */
form label[for="number"] {
  ${(selectedInputType !== "number" && "background-color:  #f00;") || ""}
  margin-top: 5px;
  letter-spacing: 2px; /* Increased letter spacing for number label */
  padding: 2px; /* Padding around the label */
}


#text {
  font-style: italic; /* Italicize text */
  box-shadow: 3px 3px 5px rgba(0, 0, 0, 0.2); /* Soft shadow for depth */
}

/* Styles for input with ID 'email' */
#email {
  font-weight: bold; /* Bold text for emphasis */
  background-color: ${primaryColor}88; /* Slightly transparent background */
}

/* Styles for input with ID 'password' */
#password {
  letter-spacing: 2px; /* Increase letter spacing for a distinct look */
  background-image: linear-gradient(to right, ${secondaryColor}, ${primaryColor}); /* Gradient background */
}

/* Styles for input with ID 'number' */
#number {
  text-align: right; /* Right-align the text */
  border: 2px dotted ${secondaryColor}; /* Dotted border for uniqueness */
  background-color: ${primaryColor}88; /* Slightly transparent background */
}



form footer button,
form footer input[type="submit"] {
  margin: 10px;
  padding: 10px;
  background-color: ${secondaryColor};
  border: none;
  border-radius: 10px;
  color: ${primaryColor};
}

`;

  const THTML = `<form class="custom-form">Add your form elements here</form>`;

  return {
    THTML,
    SHTML: html,
    TCSS: css,
    SCSS: css,
    difficulty: "medium",
    name: "Medium form",
    instructions,
    question_and_answer,
    lockCSS: true,
    lockHTML: false,
    lockJS: true,
    percentageTreshold: 95,
    percentageFullPointsTreshold: 99,
    colors: [primaryColor, secondaryColor],
    scenarioDetails: [
      {
        id: "mediumForm1",
        width: drawBoardWidth,
        height: drawBoardheight,
      },
    ],
  };
};
