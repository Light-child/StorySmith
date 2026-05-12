/**
 * Sidebar.jsx — Workspace Explorer Panel
 * ────────────────────────────────────────
 * activeView === "note"    → shows Notes list only
 * activeView === "mindmap" → shows MindMaps list + D-Node Mindmaps section
 *
 * D-node mindmaps are listed under a separate "D-Nodes" heading since they
 * are global (not canvas-owned) and behave differently from regular mindmaps.
 */

import { useState, useRef, useMemo } from "react";
import useStore from "../../State/useStore";
import styles from "./Sidebar.module.css";

// ─── Inline-rename helper ─────────────────────────────────────────────────────
function EditableLabel({ value, onSave, className }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const ref = useRef(null);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== value) onSave(draft.trim());
    else setDraft(value);
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
          if (e.key === "Enter")  commit();
          if (e.key === "Escape") { setEditing(false); setDraft(value); }
        }}
        autoFocus
      />
    );
  }
  return (
    <span className={className} onDoubleClick={() => setEditing(true)} title="Double-click to rename">
      {value}
    </span>
  );
}

// ─── Explorer item ────────────────────────────────────────────────────────────
function ExplorerItem({ label, isActive, onSelect, onRename, onDelete, badge }) {
  return (
    <div className={`${styles.item} ${isActive ? styles.itemActive : ""}`} onClick={onSelect}>
      {badge && <span className={styles.itemBadge}>{badge}</span>}
      <EditableLabel value={label} onSave={onRename} className={styles.itemLabel} />
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
  // Canvas
  const canvases       = useStore((s) => s.canvases);
  const activeCanvasId = useStore((s) => s.activeCanvasId);
  const renameCanvas   = useStore((s) => s.renameCanvas);
  const canvas         = canvases.find((c) => c.id === activeCanvasId);

  const activeView = useStore((s) => s.activeView);

  // Notes
  const notes        = useStore((s) => s.notes);
  const activeNoteId = useStore((s) => s.activeNoteId);
  const addNote      = useStore((s) => s.addNote);
  const selectNote   = useStore((s) => s.selectNote);
  const persistNote  = useStore((s) => s.persistNote);
  const removeNote   = useStore((s) => s.removeNote);

  // Regular mindmaps
  const mindmaps         = useStore((s) => s.mindmaps);
  const activeMindMapId  = useStore((s) => s.activeMindMapId);
  const addMindMap       = useStore((s) => s.addMindMap);
  const selectMindMap    = useStore((s) => s.selectMindMap);
  const persistMindMap   = useStore((s) => s.persistMindMap);
  const removeMindMap    = useStore((s) => s.removeMindMap);

  // D-node mindmaps (global)
  const dNodes            = useStore((s) => s.dNodes);
  const dNodeMindMaps     = useStore((s) => s.dNodeMindMaps);
  const selectDNodeMindMap = useStore((s) => s.selectDNodeMindMap);
  const renameDNode       = useStore((s) => s.renameDNode);
  const removeDNodeMindmap = useStore((s) => s.removeDNodeMindmap);

  // ── Filter D-nodes to only those referencing mindmaps/notes in this canvas ──
  const filteredDNodes = useMemo(() => {
    // Collect all valid source IDs for this canvas (mindmaps and notes)
    const canvasObjectIds = new Set([
      ...mindmaps.map((m) => m.mindmap_id),
      ...notes.map((n) => n.note_id)
    ]);

    return dNodes.filter((node) => {
      // 1. If it directly belongs to this canvas (canvas_id matches)
      if (node.canvas_id === activeCanvasId) return true;

      // 2. Otherwise, check if it references an object in this canvas
      if (!node.source_id) return false;
      return canvasObjectIds.has(node.source_id);
    });
  }, [dNodes, mindmaps, notes, activeCanvasId]);

  // Handler for selecting a D-node from the sidebar
  const handleSelectDNode = (node) => {
    if (node.source_type === "note" && node.source_id) {
      selectNote(node.source_id);
    } else if (node.mind_map_id) {
      selectDNodeMindMap(node.mind_map_id);
    }
  };


  return (
    <aside className={styles.root}>
      <div className={styles.glowStrip} />

      {/* ── Back ─────────────────────────────────────────────────────── */}
      <button className={styles.backBtn} onClick={onBack}>← Collection</button>

      {/* ── Canvas title ─────────────────────────────────────────────── */}
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

      {/* ── Notes (only shown in note view) ──────────────────────────── */}
      {activeView === "note" && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Notes</span>
            <button className={styles.addBtn} onClick={() => addNote("Untitled Note")} title="New note">＋</button>
          </div>
          <div className={styles.list}>
            {notes.length === 0 && <p className={styles.empty}>No notes yet</p>}
            {notes.map((note) => (
              <ExplorerItem
                key={note.note_id}
                label={note.note_name}
                isActive={activeNoteId === note.note_id}
                onSelect={() => selectNote(note.note_id)}
                onRename={(name) => persistNote(note.note_id, note.essence ?? {}, name)}
                onDelete={() => removeNote(note.note_id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Mindmaps (only shown in mindmap view) ────────────────────── */}
      {activeView === "mindmap" && (
        <>
          {/* Regular mindmaps */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>MindMaps</span>
              <button className={styles.addBtn} onClick={() => addMindMap("Untitled MindMap")} title="New mind map">＋</button>
            </div>
            <div className={styles.list}>
              {mindmaps.length === 0 && <p className={styles.empty}>No mind maps yet</p>}
              {mindmaps.map((mm) => (
                <ExplorerItem
                  key={mm.mindmap_id}
                  label={mm.mindmap_name}
                  isActive={activeMindMapId === mm.mindmap_id}
                  onSelect={() => selectMindMap(mm.mindmap_id)}
                  onRename={(name) => persistMindMap(mm.mindmap_id, mm.essence ?? { nodes: [], edges: [] }, name)}
                  onDelete={() => removeMindMap(mm.mindmap_id)}
                />
              ))}
            </div>
          </div>

          {/* D-node mindmaps — separate section, globally scoped */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              {/* Purple tinted label to distinguish from regular mindmaps */}
              <span className={`${styles.sectionLabel} ${styles.sectionLabelDNode}`}>
                D-Nodes
              </span>
              {/* No add button here — D-nodes are created from the canvas */}
            </div>
            <div className={styles.list}>
              {filteredDNodes.length === 0 && (
                <p className={styles.empty}>No D-nodes yet</p>
              )}
              {filteredDNodes.map((node) => {
                const isActive = (node.source_type === "note" && activeNoteId === node.source_id) ||
                                (node.source_type === "mindmap" && activeMindMapId === node.mind_map_id);

                return (
                  <ExplorerItem
                    key={node.node_id}
                    label={node.name}
                    badge="D"
                    isActive={isActive}
                    onSelect={() => handleSelectDNode(node)}
                    onRename={(name) => renameDNode(node.node_id, name)}
                    onDelete={() => removeDNodeMindmap(node.node_id)}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}