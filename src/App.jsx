import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { initDB } from "./features/Database/db";
import HomePage from "./pages/HomePage";
import WorkSpace from "./pages/WorkSpace";
import "./App.css";

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "default");
    initDB()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error("[StorySmith] DB init failed:", err);
        setDbError(err.message);
      });
  }, []);

  if (!dbReady) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#141414",
        color: "#f0f0f0",
        fontFamily: "'Space Mono', monospace",
        gap: "16px",
      }}>
        {dbError ? (
          <>
            <span style={{ color: "#ef4444", fontSize: "1.1rem" }}>DB Error</span>
            <span style={{ fontSize: "0.8rem", color: "#888" }}>{dbError}</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: "2rem", color: "#ef4444", animation: "spin 1s linear infinite" }}>◌</span>
            <span style={{ fontSize: "0.8rem", color: "#555", letterSpacing: "0.1em" }}>LOADING STORYSMITH…</span>
          </>
        )}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/workspace/:canvasId" element={<WorkSpace />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
