/**
 * HomePage.jsx — Canvas Collection View
 * ───────────────────────────────────────
 * The landing screen of StorySmith.
 * Shows all "Canvases" (projects) as cards in a grid.
 * The left sidebar lets users filter by Notes or MindMaps.
 * A search button sits top-right.
 * Clicking a canvas navigates to WorkSpace.jsx.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../State/useStore";
import styles from "./HomePage.module.css";

// ─── Sub-component: individual canvas card ────────────────────────────────────
function CanvasCard({ canvas, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false);

  // Format a date string to a readable form like "03/12/2024"
  const fmt = (iso) =>
    iso ? new Date(iso).toLocaleDateString("en-GB") : "—";

  return (
    <div
      className={styles.card}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail area — placeholder coloured block */}
      <div className={styles.cardThumb} />

      {/* Card body */}
      <div className={styles.cardBody}>
        <h3 className={styles.cardName}>{canvas.name}</h3>
        <p className={styles.cardMeta}>Modified: {fmt(canvas.date_last_modified)}</p>
        <p className={styles.cardMeta}>Created: {fmt(canvas.date_created)}</p>
      </div>

      {/* Delete button (shown on hover) */}
      {hovered && (
        <button
          className={styles.deleteBtn}
          onClick={(e) => {
            e.stopPropagation(); // don't trigger card click
            onDelete(canvas.id);
          }}
          title="Delete canvas"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Sub-component: the "Create New Canvas" placeholder card ─────────────────
function CreateCard({ onClick }) {
  return (
    <div className={styles.createCard} onClick={onClick}>
      <span className={styles.createIcon}>＋</span>
      <span className={styles.createLabel}>Create New Canvas</span>
    </div>
  );
}

// ─── Main HomePage component ──────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();

  // Pull what we need from the global Zustand store
  const canvases = useStore((s) => s.canvases);
  const loadCanvases = useStore((s) => s.loadCanvases);
  const addCanvas = useStore((s) => s.addCanvas);
  const removeCanvas = useStore((s) => s.removeCanvas);
  const selectCanvas = useStore((s) => s.selectCanvas);

  // Local state for the sidebar filter and search bar visibility
  const [filter, setFilter] = useState("all"); // "all" | "notes" | "mindmaps"
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Load canvases from DB on mount
  useEffect(() => {
    loadCanvases();
  }, [loadCanvases]);

  // Handle creating a new canvas with a default name
  const handleCreate = async () => {
    const name = `Canvas ${canvases.length + 1}`;
    const canvas = await addCanvas(name);
    // Jump straight into the new workspace
    if (canvas && canvas.id) {
      navigate(`/workspace/${canvas.id}`);
    }
  };

  // Handle clicking an existing canvas
  const handleOpen = (canvas) => {
    selectCanvas(canvas.id);
    navigate(`/workspace/${canvas.id}`);
  };

  const handleRemoveCanvas = (id) => {
    const canvas = canvases.find((c) => c.id === id);
    const name = canvas?.name || "this canvas";
    if (window.confirm(`Are you sure you want to permanently delete "${name}" and ALL its notes and mind maps? This cannot be undone.`)) {
      removeCanvas(id);
    }
  };

  // Filter canvases by search query
  const filtered = canvases.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.root}>
      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarGlow} /> {/* decorative red-glow strip */}

        {/* Sidebar navigation items */}
        <nav className={styles.nav}>
          {/* "My Collection" is the top-level active section */}
          <button
            className={`${styles.navItem} ${filter === "all" ? styles.navItemActive : ""}`}
            onClick={() => setFilter("all")}
          >
            My Collection
          </button>
          <button
            className={`${styles.navItem} ${filter === "notes" ? styles.navItemActive : ""}`}
            onClick={() => setFilter("notes")}
          >
            Notes
          </button>
          <button
            className={`${styles.navItem} ${filter === "mindmaps" ? styles.navItemActive : ""}`}
            onClick={() => setFilter("mindmaps")}
          >
            MindMaps
          </button>
        </nav>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className={styles.main}>
        {/* Search button — top right */}
        <button
          className={styles.searchBtn}
          onClick={() => setSearchOpen((v) => !v)}
          title="Search canvases"
        >
          🔍
        </button>

        {/* Inline search bar (shown when search is toggled open) */}
        {searchOpen && (
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search canvases…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        )}

        {/* ── Canvas Grid ────────────────────────────────────────────────── */}
        <div className={styles.grid}>
          {/* Render each canvas as a card */}
          {filtered.map((canvas) => (
            <CanvasCard
              key={canvas.id}
              canvas={canvas}
              onClick={() => handleOpen(canvas)}
              onDelete={handleRemoveCanvas}
            />
          ))}

          {/* Always show the "create" card at the end */}
          <CreateCard onClick={handleCreate} />
        </div>
      </main>
    </div>
  );
}
