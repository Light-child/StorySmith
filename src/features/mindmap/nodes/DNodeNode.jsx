// DNodeNode.jsx — D-node instance as it appears inside a mindmap canvas
// ───────────────────────────────────────────────────────────────────────
// Visually similar to EllipseNode but with a "D-NODE" badge.
// Double-clicking navigates into the D-node's own mindmap
// (replaces the old portal enterPortal behaviour).
//
// data fields expected:
//   label          — the D-node's name
//   dnodeNodeId    — the node record ID in PouchDB
//   dnodeName      — same as label, kept separately for convenience
//   dnodeMindmapId — the mindmap this D-node represents
//   bgColor        — optional theme key (same as EllipseNode)
//   onEnterDNode   — callback(dnodeMindmapId) injected by useMindMap
//   onDelete       — callback(id) injected by useMindMap
//   onChangeColor  — callback(id, colorKey) injected by useMindMap

import { useState, useEffect } from "react";
import { Handle, Position, NodeToolbar } from "reactflow";
import { THEMES } from "../themes";

const DNodeNode = ({ data, id, selected }) => {
  const [showPalette, setShowPalette] = useState(false);

  const themeKey = data.bgColor || "classical";
  const theme    = THEMES[themeKey];

  const colors = [
    { name: "Classical", key: "classical" },
    { name: "Blue",      key: "blue"      },
    { name: "Purple",    key: "purple"    },
    { name: "Green",     key: "green"     },
    { name: "Yellow",    key: "yellow"    },
    { name: "Red",       key: "red"       },
  ];

  // Double-click navigates into the D-node's content
  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (data.onEnterDNode && data.dnodeNodeId) {
      data.onEnterDNode(data.dnodeNodeId);
    }
  };

  return (
    <div className="relative group">

      {/* ── D-NODE badge ────────────────────────────────────────────── */}
      <div style={{
        position:    "absolute",
        top:         "-10px",
        right:       "-10px",
        background:  "#7e22ce",
        color:       "#fff",
        fontSize:    "9px",
        fontWeight:  "700",
        letterSpacing: "0.08em",
        padding:     "2px 6px",
        borderRadius: "999px",
        zIndex:      10,
        border:      "1px solid rgba(255,255,255,0.3)",
        pointerEvents: "none",
        fontFamily:  "monospace",
      }}>
        D-NODE
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <NodeToolbar
        isVisible={selected}
        position={Position.Right}
        className="flex flex-col gap-2 bg-gray-900 p-2 shadow-xl rounded-lg border border-gray-700"
      >
        <div className="flex gap-2">
          {/* Enter the D-node mindmap */}
          <button
            onClick={() => data.onEnterDNode?.(data.dnodeNodeId)}
            className="p-1 rounded text-xs nodrag text-indigo-400 hover:bg-gray-500/20 font-bold"
            title="Open D-Node content"
          >
            👁️
          </button>

          <button
            onClick={() => data.onDelete(id)}
            className="p-1 rounded text-xs nodrag text-red-400 hover:bg-red-500/20"
            title="Remove from this mindmap"
          >
            🗑️
          </button>

          <button
            onClick={() => setShowPalette(!showPalette)}
            className="p-1 rounded text-xs nodrag text-gray-300 hover:bg-gray-800"
            title="Choose colour"
          >
            🎨
          </button>
        </div>

        {showPalette && (
          <div className="flex gap-1 p-1 bg-gray-800 rounded border border-gray-700 nodrag">
            {colors.map((c) => (
              <button
                key={c.key}
                onClick={() => {
                  data.onChangeColor(id, c.key);
                  setShowPalette(false);
                }}
                style={{
                  backgroundColor: THEMES[c.key].bg,
                  borderColor:     THEMES[c.key].border,
                }}
                className="w-5 h-5 rounded-full border-2 hover:scale-110 transition-transform"
              />
            ))}
          </div>
        )}
      </NodeToolbar>

      {/* ── Node body ───────────────────────────────────────────────── */}
      <div
        onDoubleClick={handleDoubleClick}
        style={{
          backgroundColor: theme.bg,
          borderColor:     theme.border,
          // Purple glow to distinguish from regular ellipses
          boxShadow: selected
            ? `0 0 0 1px ${theme.ring}, 0 0 12px rgba(126,34,206,0.4)`
            : "0 0 8px rgba(126,34,206,0.25)",
          // Dashed border signals it's a special node type
          borderStyle:  "dashed",
          borderWidth:  "2px",
        }}
        className="px-8 py-4 transition-all cursor-pointer min-w-[140px] flex items-center justify-center rounded-full"
      >
        <div className="text-gray-100 font-semibold text-sm text-center select-none">
          {data.label || data.dnodeName}
        </div>
      </div>

      {/* ── Handles ─────────────────────────────────────────────────── */}
      <Handle type="target" position={Position.Top}    id="t"  className="w-1 h-1 !bg-white" />
      <Handle type="source" position={Position.Top}    id="ts" className="w-1 h-1 !bg-white opacity-0" />
      <Handle type="target" position={Position.Bottom} id="b"  className="w-1 h-1 !bg-white" />
      <Handle type="source" position={Position.Bottom} id="bs" className="w-1 h-1 !bg-white" />
      <Handle type="target" position={Position.Left}   id="l"  className="w-1 h-1 !bg-white" />
      <Handle type="source" position={Position.Left}   id="ls" className="w-1 h-1 !bg-white" />
      <Handle type="target" position={Position.Right}  id="r"  className="w-1 h-1 !bg-white" />
      <Handle type="source" position={Position.Right}  id="rs" className="w-1 h-1 !bg-white" />
    </div>
  );
};

export default DNodeNode;