/**
 * WorkSpace.jsx — The main editing environment
 * ──────────────────────────────────────────────
 * Layout:
 *   [ Sidebar ] | [ NoteEditor OR MindMapView ] | [ ActionDock ]
 *
 * The Sidebar lets the user pick which note or mindmap to open.
 * The ActionDock (right edge) lets them switch between Note / MindMap views.
 * Routing: /workspace/:canvasId
 */

import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useStore from "../State/useStore";

import Sidebar from "../features/explorer/Sidebar";
import NoteEditor from "../features/editor/NoteEditor";
import MindMapView from "../features/mindmap/MindMapView";
import ActionDock from "../components/ActionDock";

import styles from "./WorkSpace.module.css";

export default function WorkSpace() {
  const { canvasId } = useParams();  // pulled from the URL
  const navigate = useNavigate();

  // Store selectors — only re-render when these specific slices change
  const selectCanvas = useStore((s) => s.selectCanvas);
  const activeCanvasId = useStore((s) => s.activeCanvasId);
  const activeView = useStore((s) => s.activeView);

  // When the component mounts (or the URL canvasId changes),
  // tell the store to load notes + mindmaps for this canvas.
  useEffect(() => {
    if (canvasId === "undefined") {
      navigate("/");
      return;
    }
    if (canvasId && canvasId !== activeCanvasId) {
      selectCanvas(canvasId);
    }
  }, [canvasId, activeCanvasId, selectCanvas, navigate]);

  return (
    <div className={styles.root}>
      {/* ── Left: Explorer Sidebar ────────────────────────────────────── */}
      {/* Lists notes & mindmaps; lets user create / rename / delete them */}
      <Sidebar onBack={() => navigate("/")} />

      {/* ── Centre: Main View (Note editor OR MindMap) ────────────────── */}
      <main className={styles.content}>
        {activeView === "note" ? (
          /* The rich text editor, powered by TipTap */
          <NoteEditor />
        ) : (
          /* The mind-mapping canvas, powered by React-Flow */
          <MindMapView />
        )}
      </main>

      {/* ── Right: Action Dock ────────────────────────────────────────── */}
      {/* Floating panel on the right edge: switches Note ↔ MindMap views */}
      <ActionDock />
    </div>
  );
}
