/** @format */

import ReactDOM from "react-dom/client";
import App from "./App";

// const root = document.createElement("my-app-root");
// document.body.appendChild(root);

const root = document.getElementById("root");

ReactDOM.createRoot(root as HTMLElement).render(<App />);
