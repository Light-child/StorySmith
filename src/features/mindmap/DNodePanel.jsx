// DNodePanel.jsx — Right sidebar for selecting / dragging D-nodes into a mindmap
// ──────────────────────────────────────────────────────────────────────────────
// Opens when the user clicks "D-Node" in the MindMapToolbar dropdown.
// Shows (in priority order):
//   1. D-nodes in the current canvas's mindmaps
//   2. D-nodes in other canvases
//   3. All regular mindmaps (can be made into a D-node)
//   4. All notes (can be made into a D-node)
//
// The user can drag an item onto the React Flow canvas to place a D-node,
// or click it to place it at a default position.
//
// Dragging works via the HTML5 drag API — the D-node data is passed through
// dataTransfer and picked up by the onDrop handler in MindMapView.

import { useState, useMemo } from "react";
import useStore from "../../State/useStore";
import styles from "./DNodePanel.module.css";

// ─── Section component ────────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.section}>
      <button className={styles.sectionToggle} onClick={() => setOpen((v) => !v)}>
        <span className={styles.sectionArrow}>{open ? "▾" : "▸"}</span>
        {title}
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

// ─── Draggable item ───────────────────────────────────────────────────────────
function DraggableItem({ label, subtitle, onDragStart, onClick, badge }) {
  return (
    <div
      className={styles.item}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      title="Drag onto canvas or click to place"
    >
      <div className={styles.itemLeft}>
        {badge && <span className={styles.itemBadge}>{badge}</span>}
        <span className={styles.itemLabel}>{label}</span>
      </div>
      {subtitle && <span className={styles.itemSub}>{subtitle}</span>}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function DNodePanel({ onClose, onPlaceDNode }) {
  const [search, setSearch] = useState("");

  // Store data
  const dNodes          = useStore((s) => s.dNodes);
  const dNodeMindMaps   = useStore((s) => s.dNodeMindMaps);
  const mindmaps        = useStore((s) => s.mindmaps);       // regular mindmaps
  const notes           = useStore((s) => s.notes);
  const canvases        = useStore((s) => s.canvases);
  const activeCanvasId  = useStore((s) => s.activeCanvasId);
  const activeMindMapId = useStore((s) => s.activeMindMapId);

  // ── Split D-nodes into "this canvas" vs "other canvases" ─────────────────
  // A D-node "belongs" to this canvas if it appears in at least one of
  // the current canvas's mindmaps.
  const currentCanvasMindmapIds = useMemo(
    () => new Set(mindmaps.map((m) => m.mindmap_id)),
    [mindmaps]
  );

  const localDNodes = useMemo(
    () => dNodes.filter((d) =>
      d.list_of_mindmap_id.some((id) => currentCanvasMindmapIds.has(id))
    ),
    [dNodes, currentCanvasMindmapIds]
  );

  const otherDNodes = useMemo(
    () => dNodes.filter((d) =>
      !d.list_of_mindmap_id.some((id) => currentCanvasMindmapIds.has(id))
    ),
    [dNodes, currentCanvasMindmapIds]
  );

  // ── Search filter ─────────────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filterLabel = (label) => !q || label.toLowerCase().includes(q);

  // ── Canvas name lookup ───────────────────────────────────────────────────
  const canvasName = (id) =>
    canvases.find((c) => c.id === id)?.name || "Unknown canvas";

  // ── Drag start — encodes the D-node payload into dataTransfer ────────────
  const handleDragStart = (e, payload) => {
    // payload shape: { type: "dnode_existing" | "dnode_new_from_mindmap" | "dnode_new_from_note", ...data }
    e.dataTransfer.setData("application/storysmith-dnode", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  };

  // ── Click to place — calls back into MindMapView with a default position ─
  const handleClick = (payload) => {
    onPlaceDNode(payload, { x: 200, y: 200 });
  };

  return (
    <aside className={styles.panel}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <span className={styles.title}>D-Nodes</span>
        <button className={styles.closeBtn} onClick={onClose} title="Close">✕</button>
      </div>

      {/* ── Search ────────────────────────────────────────────────── */}
      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── Scrollable content ────────────────────────────────────── */}
      <div className={styles.content}>

        {/* 1. D-nodes already in this canvas */}
        <Section title="This canvas" defaultOpen={true}>
          {localDNodes.filter((d) => filterLabel(d.name)).length === 0 && (
            <p className={styles.empty}>None yet</p>
          )}
          {localDNodes.filter((d) => filterLabel(d.name)).map((d) => (
            <DraggableItem
              key={d.node_id}
              label={d.name}
              badge="D"
              onDragStart={(e) => handleDragStart(e, {
                type:          "dnode_existing",
                dnodeNodeId:   d.node_id,
                dnodeName:     d.name,
                dnodeMindmapId: d.mind_map_id,
              })}
              onClick={() => handleClick({
                type:          "dnode_existing",
                dnodeNodeId:   d.node_id,
                dnodeName:     d.name,
                dnodeMindmapId: d.mind_map_id,
              })}
            />
          ))}
        </Section>

        {/* 2. D-nodes from other canvases */}
        <Section title="Other canvases" defaultOpen={true}>
          {otherDNodes.filter((d) => filterLabel(d.name)).length === 0 && (
            <p className={styles.empty}>None</p>
          )}
          {otherDNodes.filter((d) => filterLabel(d.name)).map((d) => (
            <DraggableItem
              key={d.node_id}
              label={d.name}
              badge="D"
              subtitle={`from ${canvasName(d.canvas_id)}`}
              onDragStart={(e) => handleDragStart(e, {
                type:          "dnode_existing",
                dnodeNodeId:   d.node_id,
                dnodeName:     d.name,
                dnodeMindmapId: d.mind_map_id,
              })}
              onClick={() => handleClick({
                type:          "dnode_existing",
                dnodeNodeId:   d.node_id,
                dnodeName:     d.name,
                dnodeMindmapId: d.mind_map_id,
              })}
            />
          ))}
        </Section>

        {/* 3. Regular mindmaps — drag to create a new D-node from one */}
        <Section title="All mindmaps" defaultOpen={false}>
          {mindmaps.filter((m) => filterLabel(m.mindmap_name)).length === 0 && (
            <p className={styles.empty}>No mindmaps</p>
          )}
          {mindmaps.filter((m) => filterLabel(m.mindmap_name)).map((m) => (
            <DraggableItem
              key={m.mindmap_id}
              label={m.mindmap_name}
              badge="M"
              subtitle="Create D-node from this mindmap"
              onDragStart={(e) => handleDragStart(e, {
                type:     "dnode_new_from_mindmap",
                name:     m.mindmap_name,
                sourceId: m.mindmap_id,
              })}
              onClick={() => handleClick({
                type:     "dnode_new_from_mindmap",
                name:     m.mindmap_name,
                sourceId: m.mindmap_id,
              })}
            />
          ))}
        </Section>

        {/* 4. Notes — drag to create a new D-node from one */}
        <Section title="All notes" defaultOpen={false}>
          {notes.filter((n) => filterLabel(n.note_name)).length === 0 && (
            <p className={styles.empty}>No notes</p>
          )}
          {notes.filter((n) => filterLabel(n.note_name)).map((n) => (
            <DraggableItem
              key={n.note_id}
              label={n.note_name}
              badge="N"
              subtitle="Create D-node from this note"
              onDragStart={(e) => handleDragStart(e, {
                type:     "dnode_new_from_note",
                name:     n.note_name,
                sourceId: n.note_id,
              })}
              onClick={() => handleClick({
                type:     "dnode_new_from_note",
                name:     n.note_name,
                sourceId: n.note_id,
              })}
            />
          ))}
        </Section>

      </div>
    </aside>
  );
}