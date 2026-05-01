// DNodeTrackerNode.jsx — Appearances tracker inside a D-node's own mindmap
// ──────────────────────────────────────────────────────────────────────────
// This node lives inside the D-node's mindmap and shows a block for every
// regular mindmap that contains an instance of this D-node.
//
// Double-clicking a block navigates to that host mindmap AND attempts to
// pan/zoom the React Flow canvas to the D-node's x/y position in that map.
//
// data fields:
//   dnodeId      — the node record ID
//   dnodeName    — display name
//   hostMindmaps — array of { mindmap_id, mindmap_name, x, y }
//   onGoToHost   — callback(mindmapId, x, y) injected by useMindMap

import { Handle, Position, NodeResizer } from "reactflow";
import styles from "./DNodeTrackerNode.module.css";

const DNodeTrackerNode = ({ data, selected }) => {
  const hosts = data.hostMindmaps || [];

  return (
    <div className={`${styles.root} ${selected ? styles.selected : ""}`}>
      <NodeResizer
        color="var(--accent, #7e22ce)"
        isVisible={selected}
        minWidth={220}
        minHeight={80}
      />

      <Handle type="target" position={Position.Top}    id="t"  className={styles.handle} />
      <Handle type="source" position={Position.Bottom} id="b"  className={styles.handle} />
      <Handle type="target" position={Position.Left}   id="l"  className={styles.handle} />
      <Handle type="source" position={Position.Right}  id="r"  className={styles.handle} />

      {/* Header */}
      <div className={styles.header}>
        <span className={styles.badge}>TRACKER</span>
        <span className={styles.title}>
          "{data.dnodeName}" appears in
        </span>
      </div>

      {/* Appearance blocks */}
      <div className={styles.list}>
        {hosts.length === 0 && (
          <p className={styles.empty}>No appearances yet</p>
        )}
        {hosts.map((host) => (
          <button
            key={host.mindmap_id}
            className={`${styles.hostBlock} nodrag`}
            onDoubleClick={() => {
              // Navigate to the host mindmap and pan to the D-node's position
              data.onGoToHost?.(host.mindmap_id, host.x, host.y);
            }}
            title={`Double-click to go to "${host.mindmap_name}"`}
          >
            <span className={styles.hostIcon}>⬡</span>
            <span className={styles.hostName}>{host.mindmap_name}</span>
            <span className={styles.hostCoords}>
              {Math.round(host.x)}, {Math.round(host.y)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DNodeTrackerNode;