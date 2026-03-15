/**
 * ActionDock.jsx — Floating View-Switcher
 * ─────────────────────────────────────────
 * A small vertical pill on the right edge of the Workspace.
 * Contains two icon buttons:
 *   📄 — switch to Note editor (Tiptap)
 *   🧠 — switch to MindMap view (React Flow)
 *
 * The active view's button gets the red accent highlight.
 * Icons are from lucide-react (already in your package.json).
 */

import { FileText, Brain } from "lucide-react";
import useStore from "../State/useStore";
import styles from "./ActionDock.module.css";

export default function ActionDock() {
  const activeView = useStore((s) => s.activeView);
  const setActiveView = useStore((s) => s.setActiveView);

  return (
    <div className={styles.dock}>
      {/* ── Note editor button ────────────────────────────────────────── */}
      <button
        className={`${styles.btn} ${activeView === "note" ? styles.btnActive : ""}`}
        onClick={() => setActiveView("note")}
        title="Switch to Note editor"
        aria-label="Open note editor"
      >
        <FileText size={22} strokeWidth={1.8} />
      </button>

      {/* ── MindMap button ────────────────────────────────────────────── */}
      <button
        className={`${styles.btn} ${activeView === "mindmap" ? styles.btnActive : ""}`}
        onClick={() => setActiveView("mindmap")}
        title="Switch to Mind Map"
        aria-label="Open mind map"
      >
        <Brain size={22} strokeWidth={1.8} />
      </button>
    </div>
  );
}
