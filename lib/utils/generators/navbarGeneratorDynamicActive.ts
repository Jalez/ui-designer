/** @format */

import { drawBoardWidth, drawBoardheight } from "@/constants";
import { generator } from "@/types";

export const ActiveNavbarGenerator: generator = () => {
  const question_and_answer = {
    question: "What are lists in html?",
    answer: `Lists in HTML are used to present list of information in well formed and semantic way. There are three different types of lists in HTML and each one has a specific purpose and meaning. The three types of lists are: ordered list, unordered list, and definition list.`,
  };

  const html = `<nav id="navbar">
  <ul>
      <li><a href="#" id="home">Home</a></li>
      <li><a href="#" id="about">About</a></li>
      <li><a href="#" id="services">Services</a></li>
      <li><a href="#" id="contact">Contact</a></li>
  </ul>
</nav>
<div id="dialog" style="display:none;"></div>`;

  const css = `#root {    
    margin: 0px;
    padding: 0px;
    overflow: hidden;
    position: relative; 
    background-color: #fff; 
  }

body {
  font-family: Arial, sans-serif;
}

nav#navbar ul {
  list-style: none;
  background-color: #333;
  text-align: center;
  padding: 0;
  margin: 0;
}


nav#navbar ul li {
  display: inline;
}

nav#navbar ul li a {
  text-decoration: none;
  color: white;
  background-color: #333;
  padding: 10px 20px;
  display: inline-block;
}

#dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 1px solid #333;
  padding: 20px;
  background-color: white;
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
  z-index: 1000;
}
`;

  const SJS = `const dialog = document.getElementById('dialog');

function openDialog(text) {
    dialog.textContent = text;
    dialog.style.display = 'block';
}

function setupLink(id, message) {
    const link = document.getElementById(id);
    link.addEventListener('click', function(event) {
        event.preventDefault(); // Prevent default anchor behavior
        openDialog(message);
    });
}

// Setup links
setupLink('home', 'Welcome to the Home Page!');
setupLink('about', 'Learn more About Us.');
setupLink('services', 'Our Services are listed here.');
setupLink('contact', 'Contact Us here.');

  `;

  return {
    THTML: html,
    SHTML: html,
    TCSS: css,
    SCSS: css,
    TJS: "",
    SJS: SJS,
    difficulty: "medium",
    name: "Medium Navbar",
    instructions: [
      {
        title: "Task Overview:",
        content: [
          "In this exercise, you're provided with a template for setting up interactive links on a webpage. Your task is to write the JavaScript code necessary to handle click events on the links and display corresponding messages in a dialog box.",
        ],
      },
      {
        title: "JavaScript Objectives:",
        content: [
          "Understand how to select elements in the DOM using JavaScript.",
          "Learn to set up event listeners to handle user interactions.",
          "Practice displaying content dynamically based on user actions.",
        ],
      },
      {
        title: "Key Concepts to Explore:",
        content: [
          "To complete your task, consider exploring the following JavaScript concepts:",
          "Selecting elements using document.getElementById.",
          "Setting up event listeners with addEventListener.",
          "Updating content dynamically by modifying element properties.",
        ],
      },
    ],
    question_and_answer,
    lockCSS: true,
    lockHTML: true,
    lockJS: false,
    events: ["click"],
    percentageTreshold: 95,
    percentageFullPointsTreshold: 98,
    colors: ["#333", "#fff"],
    scenarioDetails: [
      {
        width: drawBoardWidth,
        height: drawBoardheight,
        js: "document.getElementById('about').click();",
        id: "mediumNavbar1",
      },
      {
        width: drawBoardWidth,
        height: drawBoardheight,
        js: "document.getElementById('services').click();",
        id: "mediumNavbar2",
      },
      // {
      //   width: drawBoardheight,
      //   height: drawBoardWidth,
      // },
    ],
  };
};
