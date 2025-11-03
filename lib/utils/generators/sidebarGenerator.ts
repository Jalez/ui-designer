/** @format */

import { drawBoardWidth, drawBoardheight } from "@/constants";
import { generator } from "@/types";

const navLinks = ["Home", "About", "Services", "Contact"];
const widgetTypes = ["search", "newsletter", "profile", "social"];
const sidebarStyles = ["classic", "modern", "minimal"];

export const sidebarGenerator: generator = () => {
  const selectedStyle =
    sidebarStyles[Math.floor(Math.random() * sidebarStyles.length)];
  const selectedWidgets = widgetTypes
    .sort(() => 0.5 - Math.random())
    .slice(0, 2);

  // Generate navigation links
  const navHTML = navLinks
    .map((link) => `<li><a href="#">${link}</a></li>`)
    .join("\n    ");

  // Generate widgets based on the selected types
  const widgetsHTML = selectedWidgets
    .map((widget) => {
      switch (widget) {
        case "search":
          return `<div class="widget search"><input type="search" placeholder="Search..."></div>`;
        case "newsletter":
          return `<div class="widget newsletter"><input type="email" placeholder="Email"><button>Subscribe</button></div>`;
        case "profile":
          return `<div class="widget profile"><img src="profile.jpg" alt="Profile"><p>Username</p></div>`;
        case "social":
          return `<div class="widget social"><a href="#">Facebook</a><a href="#">Twitter</a></div>`;
        default:
          return "";
      }
    })
    .join("\n    ");

  const html = `<aside class="custom-sidebar ${selectedStyle}" id="sidebar-${selectedStyle}">
        <ul class="nav">${navHTML}</ul>
        ${widgetsHTML}
    </aside>`;

  const css = `
.custom-sidebar {
    width: 250px;
    padding: 20px;
    background-color: #f9f9f9;
    color: #333;
}

.custom-sidebar ul.nav {
    list-style: none;
    padding: 0;
}

.custom-sidebar ul.nav li a {
    color: #333;
    text-decoration: none;
    padding: 5px 0;
    display: block;
}

.custom-sidebar .widget {
    margin-top: 20px;
    text-align: center;
}

.custom-sidebar .search input {
    width: 100%;
    padding: 5px;
}

.custom-sidebar .newsletter input, .custom-sidebar .newsletter button {
    width: 100%;
    padding: 5px;
    margin-top: 5px;
}

.custom-sidebar .profile img {
    width: 100px;
    height: 100px;
    border-radius: 50%;
}

.custom-sidebar .social a {
    color: #333;
    text-decoration: none;
    display: inline-block;
    margin-right: 10px;
}

.custom-sidebar.classic {
    /* Classic style specific CSS */
    border: 1px solid #ccc;
    border-radius: 5px;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
    background-color: #f1f1f1;
    color: #333;
}

.custom-sidebar.modern {
    /* Modern style specific CSS */
    background-color: #333;
    color: #f1f1f1;
    border: none;
    box-shadow: none;
}

.custom-sidebar.minimal {
    /* Minimal style specific CSS */
    background-color: #f1f1f1;
    color: #333;
    border: none;
    box-shadow: none;
}
`;

  const THTML = `<aside class="custom-sidebar">Add your sidebar content here</aside>`;

  return {
    THTML,
    SHTML: html,
    TCSS: css,
    SCSS: css,
    lockCSS: false,
    lockHTML: true,
    lockJS: true,
    percentageTreshold: 90,
    percentageFullPointsTreshold: 98,
    colors: ["#333", "#f1f1f1", "#f9f9f9", "#ccc"],
    difficulty: "easy",
    name: "Easy sidebar",
    instructions: [
      {
        title: "Requirements",
        content: [
          "Create a sidebar layout with a width of 250px",
          "Add a navigation menu with links: Home, About, Services, Contact",
          "Add two widgets of your choice",
          "Style the sidebar using the provided CSS",
        ],
      },
    ],
    question_and_answer: {
      question: "Create a sidebar layout",
      answer: "aside.custom-sidebar",
    },
    scenarioDetails: [
      {
        width: drawBoardWidth,
        height: drawBoardheight,
        id: "easySidebar",
      },
    ],
  };
};
