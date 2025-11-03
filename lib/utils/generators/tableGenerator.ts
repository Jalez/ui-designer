import { drawBoardWidth, drawBoardheight } from "@/constants";
import { generator } from "@/types";

const tableHeaders = ["Header 1", "Header 2", "Header 3", "Header 4"];
const tableData = [
  ["Row 1, Cell 1", "Row 1, Cell 2", "Row 1, Cell 3", "Row 1, Cell 4"],
  ["Row 2, Cell 1", "Row 2, Cell 2", "Row 2, Cell 3", "Row 2, Cell 4"],
  ["Row 3, Cell 1", "Row 3, Cell 2", "Row 3, Cell 3", "Row 3, Cell 4"],
  ["Row 4, Cell 1", "Row 4, Cell 2", "Row 4, Cell 3", "Row 4, Cell 4"],
  ["Row 5, Cell 1", "Row 5, Cell 2", "Row 5, Cell 3", "Row 5, Cell 4"],
];
const tableStyles = ["bordered", "striped", "minimal"];

export const tableGenerator: generator = () => {
  const primaryColor = "#000000";
  const secondaryColor = "#ffffff";
  const tertiaryColor = "#000000";
  const currentTime = new Date();
  const hour = currentTime.getHours();
  const timeIndex = Math.floor(hour / 2);

  // Select content based on time index

  const selectedStyle = tableStyles[timeIndex % tableStyles.length];

  const instructions = [
    {
      title: "Requirements:",
      content: [
        "Use 'pixel' units for measurements such as padding, font sizes, and borders.",
        "Adhere to a color palette based on default colors or those included in the template.",
        "Focus on styling table headers, cells, and the footer for clarity and readability.",
      ],
    },
    {
      title: "Styling Suggestions:",
      content: [
        "Experiment with padding and font sizes to improve legibility.",
        "Explore different ways to style table headers (<code>th</code>) and cells (<code>td</code>).",
        "Think about how to use colors and borders to distinguish table rows or columns.",
        "Style the table caption and footer to complement the overall table design.",
      ],
    },
    {
      title: "Exploration Resources:",
      content: [
        "To enhance your understanding of CSS styling for tables, you may find the following resources helpful:",
        "Search 'CSS Table Styling' on MDN Web Docs for a comprehensive guide to table styling in CSS.",
        "Look up 'Responsive Table Design' to learn how to make tables look good on different screen sizes.",
        "Investigate 'CSS Pseudo-classes' to discover ways to style specific parts of your table.",
      ],
    },
  ];

  const question_and_answer = {
    question: "What are tables in html?",
    answer: `HTML tables allow web developers to arrange data into rows and columns. They are used to display data in a tabular format and are created using the <table> tag. The <tr> tag is used to define the rows of the table, and the <td> tag is used to define the data cells. The <th> tag is used to define the header cells of the table. The <thead>, <tbody>, and <tfoot> tags are used to group the header, body, and footer of the table, respectively.`,
  };
  // Generate table headers
  const headersHTML = tableHeaders
    .map((header) => `<th>${header}</th>`)
    .join("");

  // Generate table rows and cells
  const rowsHTML = tableData
    .map((row, index) => {
      const rowCells = row.map((cell) => `<td>${cell}</td>`).join("");
      return `<tr>${rowCells}</tr>`;
    })
    .join("\n    ");

  const html = `
  <table class="custom-table minimal" id="table-minimal">
        <caption>Current League Standings</caption>
  
      <thead>
          <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>Games Played</th>
              <th>Points</th>
          </tr>
      </thead>
      <tbody>
          <tr>
              <td>1</td>
              <td>Aston Villa</td>
              <td>10</td> 
              <td class="points"> 30</td> 
          </tr>
          <tr>
              <td>2</td>
              <td>Manchester U</td>
              <td>10</td> 
              <td class="points">15</td> 
          </tr>
               <tr>
              <td>3</td>
              <td>Liverpool</td>
              <td>10</td> 
              <td class="points">10</td>
          </tr>
          <tr>
              <td>4</td>
              <td>Chelsea</td>
              <td>10</td> 
              <td class="points">5</td>
          </tr>
          <tr>
              <td>5</td>
              <td>Arsenal</td>
              <td>10</td> 
              <td class="points">1</td>
          </tr>
          <!-- Additional rows for other teams if necessary -->
      </tbody>
      <tfoot class="footer">
          <tr>
              <td colspan="3">Total Points</td>
              <td>61</td> <!-- Sum of Points -->
          </tr>
      </tfoot>
  </table>
  
  <footer>
    <p>As always, Aston Villa reigns <strong>supreme</strong>.</p>
  </footer>`;

  const css = `#root {    
    overflow: hidden;
    background-color: ${secondaryColor};
  }
  
  .custom-table {
      width: 100%;
      border-collapse: collapse;
  }
  
  footer {
    text-align: center; 
  }
  
   th, td {
     font-size: 20px; 
  }
  
  strong {
    text-decoration: underline; 
  }
  
  caption {
    font-size: 30px; 
  }
  
  td:nth-child(4) {
    background-color: ${tertiaryColor};
    color: white; 
  }
  
  td:nth-child(1n) {
    border-color: ${primaryColor};
  }
  
  .custom-table.minimal th {
      border-bottom: 5px solid ${primaryColor};
  }
  
  .footer tr td {
    border-bottom: none; 
  }
  
  td {
      border-bottom: 1px solid ${primaryColor};
  }
  
`;

  const THTML = `<table class="custom-table">Add your table content here</table>`;
  const TCSS = `#root {    
    overflow: hidden;
    background-color: ${secondaryColor};
  }
  
  .custom-table {
      width: 100%;
      border-collapse: collapse;
  }`;

  return {
    THTML: html,
    SHTML: html,
    TCSS: TCSS,
    SCSS: css,
    difficulty: "easy",
    name: "Easy table",
    instructions,
    question_and_answer,
    lockCSS: false,
    lockHTML: true,
    lockJS: true,
    percentageTreshold: 90,
    percentageFullPointsTreshold: 98,
    colors: [primaryColor, secondaryColor, tertiaryColor],
    scenarioDetails: [
      {
        width: drawBoardWidth,
        height: drawBoardheight,
        js: "",
        id: "easyTable1",
      },
    ],
  };
};
