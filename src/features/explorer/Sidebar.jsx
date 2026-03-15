/**
 * Sidebar.jsx — Workspace Explorer Panel
 * ────────────────────────────────────────
 * Shows only the content type relevant to the current view:
 *   activeView === "note"    → lists Notes only
 *   activeView === "mindmap" → lists MindMaps only
 *
 * Switching views via the ActionDock updates activeView in the store,
 * which causes the sidebar to swap its list automatically.
 * The last active note and last active mindmap are remembered independently
 * so switching back always returns to where you left off.
 */

import { useState, useRef } from "react";
import useStore from "../../State/useStore";
import styles from "./Sidebar.module.css";

// ─── Inline-rename helper ─────────────────────────────────────────────────────
// Double-click an item to turn it into an input field.
function EditableLabel({ value, onSave, className }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== value) onSave(draft.trim());
    else setDraft(value); // revert if blank
  };

  if (editing) {
    return (
      <input
        ref={ref}
        className={styles.inlineInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setEditing(false); setDraft(value); }
        }}
        autoFocus
      />
    );
  }

  return (
    <span
      className={className}
      onDoubleClick={() => setEditing(true)}
      title="Double-click to rename"
    >
      {value}
    </span>
  );
}

// ─── Single list item ─────────────────────────────────────────────────────────
function ExplorerItem({ label, isActive, onSelect, onRename, onDelete }) {
  return (
    <div
      className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
      onClick={onSelect}
    >
      <EditableLabel
        value={label}
        onSave={onRename}
        className={styles.itemLabel}
      />
      <button
        className={styles.itemDelete}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar({ onBack }) {
  // ── Canvas ──────────────────────────────────────────────────────────────
  const canvases      = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);
  const renameCanvas  = useStore((s) => s.renameCanvas);
  const canvas        = canvases.find((c) => c.id === activeCanvasId);

  // ── Active view — determines which list to show ──────────────────────────
  const activeView    = useStore((s) => s.activeView);

  // ── Notes ────────────────────────────────────────────────────────────────
  const notes         = useStore((s) => s.notes);
  const activeNoteId  = useStore((s) => s.activeNoteId);
  const addNote       = useStore((s) => s.addNote);
  const selectNote    = useStore((s) => s.selectNote);
  const persistNote   = useStore((s) => s.persistNote);
  const removeNote    = useStore((s) => s.removeNote);

  // ── MindMaps ─────────────────────────────────────────────────────────────
  const mindmaps        = useStore((s) => s.mindmaps);
  const activeMindMapId = useStore((s) => s.activeMindMapId);
  const addMindMap      = useStore((s) => s.addMindMap);
  const selectMindMap   = useStore((s) => s.selectMindMap);
  const persistMindMap  = useStore((s) => s.persistMindMap);
  const removeMindMap   = useStore((s) => s.removeMindMap);

  // ── Derived: label + add handler for the current view ───────────────────
  // These drive the section header so it always reflects what's shown.
  const sectionLabel  = activeView === "note" ? "Notes" : "MindMap";
  const handleAdd     = activeView === "note"
    ? () => addNote("Untitled Note")
    : () => addMindMap("Untitled MindMap");

  return (
    <aside className={styles.root}>
      {/* Decorative accent glow strip on the right edge */}
      <div className={styles.glowStrip} />

      {/* ── Back button ──────────────────────────────────────────────── */}
      <button className={styles.backBtn} onClick={onBack} title="Back to collection">
        ← Collection
      </button>

      {/* ── Canvas title (double-click to rename) ────────────────────── */}
      <div className={styles.canvasTitle}>
        {canvas ? (
          <EditableLabel
            value={canvas.name}
            onSave={(name) => renameCanvas(canvas.id, name)}
            className={styles.canvasTitleText}
          />
        ) : (
          <span className={styles.canvasTitleText}>…</span>
        )}
      </div>

      {/* ── Content section — swaps between Notes and MindMaps ───────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>{sectionLabel}</span>
          <button
            className={styles.addBtn}
            onClick={handleAdd}
            title={`New ${sectionLabel.toLowerCase()}`}
          >
            ＋
          </button>
        </div>

        <div className={styles.list}>
          {/* ── Notes list (shown when activeView === "note") ─────────── */}
          {activeView === "note" && (
            <>
              {notes.length === 0 && (
                <p className={styles.empty}>No notes yet</p>
              )}
              {notes.map((note) => (
                <ExplorerItem
                  key={note.note_id}
                  label={note.note_name}
                  isActive={activeNoteId === note.note_id}
                  onSelect={() => selectNote(note.note_id)}
                  onRename={(name) =>
                    persistNote(note.note_id, note.essence ?? {}, name)
                  }
                  onDelete={() => removeNote(note.note_id)}
                />
              ))}
            </>
          )}

          {/* ── MindMaps list (shown when activeView === "mindmap") ────── */}
          {activeView === "mindmap" && (
            <>
              {mindmaps.length === 0 && (
                <p className={styles.empty}>No mind maps yet</p>
              )}
              {mindmaps.map((mm) => (
                <ExplorerItem
                  key={mm.mindmap_id}
                  label={mm.mindmap_name}
                  isActive={activeMindMapId === mm.mindmap_id}
                  onSelect={() => selectMindMap(mm.mindmap_id)}
                  onRename={(name) =>
                    persistMindMap(
                      mm.mindmap_id,
                      mm.essence ?? { nodes: [], edges: [] },
                      name
                    )
                  }
                  onDelete={() => removeMindMap(mm.mindmap_id)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}