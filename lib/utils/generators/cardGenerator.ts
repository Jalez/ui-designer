/** @format */

import { generator } from "@/types";

const cardTitles = ["This is the cards header"];
const cardContents = ["This is card content."];
const cardStyles = ["solid", "outlined", "rounded", "minimal"];
const buttonTypes = ["More Info", "Buy Now", "Learn More"];

export const cardGenerator: generator = () => {
  const primaryColor = "#f1f1f1";
  const secondaryColor = "#333";

  // Determine the current time and assign indexes based on time intervals
  const currentTime = new Date();
  const hour = currentTime.getHours();
  const timeIndex = Math.floor(hour / 2);

  // Select content based on time index
  const selectedTitle = cardTitles[timeIndex % cardTitles.length];
  const selectedContent = cardContents[timeIndex % cardContents.length];
  const selectedStyle = cardStyles[timeIndex % cardStyles.length];
  const selectedButtonText = buttonTypes[timeIndex % buttonTypes.length];

  const instructions = [
    {
      title: "Requirements:",
      content: [
        `Create a <strong>card</strong> that uses the <strong>${selectedStyle}</strong> class, titled "${selectedTitle}" (see model version for details). The card should have a button with the text "${selectedButtonText}". You must use the correct class names and semantic tags to style the card and its content. For instance, the semantic tags <strong>"header", "section" and "footer"</strong> should be present, each included with appropriate child elements. You can look at the stylesheet and provided picture for reference.`,
      ],
    },
  ];

  const question_and_answer = {
    question: "What are cards in html?",
    answer: `A card is a flexible and extensible content container. Often used to display limited information concerning articles, blog posts, and products, they also host interactive elements such as buttons, links and forms. Cards are a popular design pattern because they are easy to use and can be customized to fit a wide range of content and styles.`,
  };

  const html = `<article class="custom-card ${selectedStyle}">
        <header>
          <h2>${selectedTitle}</h2>
        </header>
        <section>
          <p>
          The word <em>italic</em> and  <strong>bold</strong> in this paragraph use semantic tags denoting <i>emphasized text</i> and <b>great urgency</b> respectively.
          </p>
        </section>
        <footer>
          <button>${selectedButtonText}</button>
        </footer>
    </article>`;

  const css = `

#root {    
margin: 0px;
padding: 0px;
overflow: hidden;
background-color: ${secondaryColor};
color: ${primaryColor};
}

.custom-card {
    text-align: center;
    margin: 10px;
    padding: 20px;
}

.custom-card header, .custom-card section, .custom-card footer {
    padding: 5px;
}

b {
    font-weight: bold;
    font-size: 20px;
    color: #EE4B2B;
}

strong {
    font-weight: bold;
    font-size: 20px;
}

em {
    font-style: italic;
    font-size: 20px;
}

i {
    font-style: italic;
    font-size: 20px;
    color: #EE4B2B;
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

section p {
    margin: 0;
    font-size: 15px;
}

button {
    padding: 10px 20px;
    border: none;
    text-transform: uppercase;
}

.solid {
    background-color: ${primaryColor};
    color: ${secondaryColor};
}

.outlined {
    box-sizing: border-box;
    border: 2px solid ${primaryColor};
    background-color: transparent;
    color: ${primaryColor};
}

.rounded {
    box-sizing: border-box;
    background-color: ${primaryColor};
    color: ${secondaryColor};
    border-radius: 10px;
}

.minimal {
    background-color: transparent;
    color: ${primaryColor};
}

.solid button {
    background-color: ${secondaryColor};
    color: ${primaryColor};
}

.outlined button {
    background-color: ${primaryColor};
    color: ${secondaryColor};
}

.rounded button {
    background-color: ${secondaryColor};
    color: ${primaryColor};
    border-radius: 5px;
}

.minimal button {
    box-sizing: border-box;
    background-color: ${primaryColor};
    color: ${secondaryColor};
    border: 2px solid ${primaryColor};
}
`;

  const THTML = `<article class="custom-card">Add your card content here</article>`;

  return {
    THTML,
    SHTML: html,
    TCSS: css,
    SCSS: css,
    instructions,
    question_and_answer,
    difficulty: "easy",
    name: "Easy card",
    lockCSS: true,
    lockHTML: false,
    lockJS: true,
    percentageTreshold: 95,
    percentageFullPointsTreshold: 99,
    colors: [primaryColor, secondaryColor],
    scenarioDetails: [
      {
        width: 400,
        height: 300,
        id: "easyCard1",
      },
    ],
  };
};
