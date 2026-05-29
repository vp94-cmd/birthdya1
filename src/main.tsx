import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Import your global CSS here if you have one, e.g.:
// import "./index.css";

// NOTE: BrowserRouter lives in App.tsx.
// Do NOT add another <BrowserRouter> here – nesting two routers causes
// routes to behave incorrectly and can cause blank screens.

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(
    '[main] Could not find #root element. Make sure index.html has <div id="root"></div>.'
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
