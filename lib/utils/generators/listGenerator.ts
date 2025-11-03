/** @format */

import { drawBoardWidth, drawBoardheight } from "@/constants";
import { generator } from "@/types";

const listItems = ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"];
const listStyles = ["bullet", "numbered", "interactive", "minimal"];
const listColors = ["red", "blue", "green", "purple", "orange"];

export const listGenerator: generator = () => {
  const currentTime = new Date();
  const hour = currentTime.getHours();
  const timeIndex = Math.floor(hour / 2);

  const selectedStyle = listStyles[timeIndex % listStyles.length];
  // Randomly select style and a subset of list items
  const selectedItems = listItems;

  const instructions = [
    {
      title: "Requirements",
      content: [
        "Only use 'pixel' units for measurements like margins, padding, and font sizes.",
        "Limit your color choices to default colors or those included in the template.",
        "Focus on how to position the two lists (store and work) side by side.",
      ],
    },
    {
      title: "Exploration Suggestions",
      content: [
        "For arranging the lists side by side, consider researching various CSS properties and techniques. Here are some keywords and resources to start your exploration:",
        "Search for 'CSS Flexbox' on websites like MDN Web Docs or CSS-Tricks for a comprehensive guide.",
        "Look up 'CSS Float Layout' for understanding the traditional float-based layouts.",
        "Investigate 'CSS display inline-block' for an alternative approach to layouts.",
      ],
    },
    {
      title: "Additional Guidelines",
      content: [
        "You are not required to use the same selectors as in our model solution. Experiment with different ones to achieve the layout.",
        "Feel free to try out various styles for lists, headings, and other elements within the unit and color constraints.",
      ],
    },
  ];

  const question_and_answer = {
    question: "What are lists in html?",
    answer: `Lists in HTML are used to present list of information in well formed and semantic way. There are three different types of lists in HTML and each one has a specific purpose and meaning. The three types of lists are: ordered list, unordered list, and definition list.`,
  };

  // Generate HTML for list items, with one item appearing as hovered
  const itemsHTML = selectedItems
    .map(
      (item, index) =>
        `<li class="${index === 0 ? "hovered" : ""}">${item}</li>`
    )
    .join("\n    ");

  const listTag = selectedStyle === "numbered" ? "ol" : "ul";

  const html = `<article>
  <header>
    <h1>
      Todays TODOS
    </h1>
  </header>
    <div class="list-container">
      <section>
            <h2> Store</h2>
            <ul class="custom-list bullet" id="list-bullet">
                <li class="done">Bananas</li>
                <li class="done">Tomatoes</li>
                <li class="next">Bread</li>
                <li class="todo">Butter</li>
            </ul>
      </section>
        <section
          class="right-section">
          <h2> Work</h2>
            <ol class="custom-list upper-roman" id="list-bullet">
                <li class="done">Daily meeting</li>
                <li class="done">Coffee break</li>
                <li class="done">"Team building"</li>
                <li class="next">Lunch</li>
            </ol>
      </section>
    </div>
</article>`;

  const css = `#root {    
    margin: 0px;
    padding: 0px;
    overflow: hidden;
    position: relative; 
    background-color: #FFF; 
}

article {
background-color: #222;
color: #FFF;
margin: 10px;
}

header h1 {
margin: 0px; 
font-size: 40px; 
text-align: center; 
}


h2 {
font-size: 30px;
margin: 30px;
margin-top: 10px; 
margin-bottom: 0px; 
}

.list-container {
display: flex; 
}

ul, ol {
margin: 0px;
line-height: 40px; 
font-size: 20px; 
}

.upper-roman {
list-style-type: upper-roman; 
}

.done {
text-decoration: line-through;
color: #888;
}

.next {
font-weight: bold; 
text-decoration: underline; 
}
`;

  const THTML = `<ul class="custom-list">Add your list items here</ul>`;

  return {
    THTML: html,
    SHTML: html,
    TCSS: `#root {    
      margin: 0px;
      padding: 0px;
      overflow: hidden;
      position: relative; 
      background-color: #FFF; 
    }`,
    SCSS: css,
    difficulty: "medium",
    name: "Medium list",
    instructions,
    question_and_answer,
    lockCSS: false,
    lockHTML: true,
    lockJS: true,
    percentageTreshold: 90,
    percentageFullPointsTreshold: 98,
    colors: ["#222", "#FFF", "#888"],
    scenarioDetails: [
      {
        width: drawBoardWidth,
        height: drawBoardheight,
        id: "mediumList1",
      },
    ],
  };
};
