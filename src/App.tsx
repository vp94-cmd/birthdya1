import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary";

// Lazy-load Admin so a crash inside it is isolated and reported clearly.
// This also prevents Admin from being imported at the top level where a
// module-load error would silently blank the whole page.
const Admin = lazy(() =>
  import("./pages/Admin").catch((err) => {
    console.error("[App] Failed to load Admin component:", err);
    // Return a fallback module so the app doesn't just show nothing.
    return {
      default: () => (
        <div style={{ padding: "2rem", color: "red" }}>
          <h2>Failed to load Admin page</h2>
          <pre>{String(err)}</pre>
        </div>
      ),
    };
  })
);

// Change this import path if your main page lives elsewhere.
// Using the same lazy+catch pattern for safety.
const Home = lazy(() =>
  import("./pages/Home").catch((err) => {
    console.error("[App] Failed to load Home component:", err);
    return {
      default: () => (
        <div style={{ padding: "2rem", color: "red" }}>
          <h2>Failed to load Home page</h2>
          <pre>{String(err)}</pre>
        </div>
      ),
    };
  })
);

function App() {
  return (
    // BrowserRouter must wrap everything exactly once.
    // Do NOT also wrap in main.tsx – pick one place.
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense
          fallback={
            <div style={{ padding: "2rem", textAlign: "center" }}>
              Loading…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/admin"
              element={
                // Extra ErrorBoundary just for the admin route so a crash
                // here doesn't kill the rest of the app.
                <ErrorBoundary>
                  <Admin />
                </ErrorBoundary>
              }
            />
            {/* Add more routes here as needed */}
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
