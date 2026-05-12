// nodes/EllipseNode.jsx — General purpose node (ellipse shape)
// Supports colour themes, portals, and inline label editing.
// Presentational only — logic lives in useMindMap.js via data callbacks.

import { useState, useEffect } from "react";
import { Handle, Position, NodeToolbar } from "reactflow";
import { THEMES } from "../themes"; // updated path

const EllipseNode = ({ data, id, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || "New Ellipse");
  const [showPalette, setShowPalette] = useState(false);

  const isReference = data.isReference;
  const isPortal = data.isPortal;

  // Resolve theme
  const themeKey = data.bgColor || "classical";
  const theme = THEMES[themeKey];

  useEffect(() => {
    setLabel(data.label);
  }, [data.label]);

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (!isReference) setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    data.onLabelChange?.(id, label);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleBlur();
    if (e.key === "Backspace") e.stopPropagation();
  };

  const colors = [
    { name: "Blue", key: "blue" },
    { name: "Purple", key: "purple" },
    { name: "Green", key: "green" },
    { name: "Yellow", key: "yellow" },
    { name: "Red", key: "red" },
    {name: "Classical", key: "classical"}
  ];

  return (
    <div className="relative group">
      {/* PORTAL BADGE */}
      {isPortal && (
        <div className="absolute -top-2 -right-2 bg-gray-600 text-white text-[10px] px-1.5 py-0.5 rounded-full z-10 animate-pulse border border-white">
          PORTAL
        </div>
      )}

      {/* TOOLBAR */}
      {!isReference && (
        <NodeToolbar
          isVisible={data.forceToolbar || selected}
          position={Position.Right}
          className="flex flex-col gap-2 bg-gray-900 p-2 shadow-xl rounded-lg border border-gray-700"
        >
          <div className="flex gap-2">
            <button
              onClick={() => {
                console.log("[StorySmith] Create Portal clicked for node:", id);
                data.onPromoteToDNode?.(id, label);
              }}
              className="p-1 rounded text-xs nodrag text-indigo-400 hover:bg-gray-500/20 font-bold"
              title="Create Portal (Promote to D-Node)"
            >
              ➕
            </button>

            <button
              onClick={() => data.onDelete(id)}
              className="p-1 rounded text-xs nodrag text-red-400 hover:bg-red-500/20"
              title="Delete"
            >
              🗑️
            </button>

            <button
              onClick={() => setShowPalette(!showPalette)}
              className="p-1 rounded text-xs nodrag text-gray-300 hover:bg-gray-800"
              title="Choose Color"
            >
              🎨
            </button>
          </div>

          {showPalette && (
            <div className="flex gap-1 p-1 bg-gray-800 rounded border border-gray-700 nodrag">
              {colors.map((c) => (
                <button
                  key={c.name}
                  onClick={() => {
                    data.onChangeColor(id, c.key);
                    setShowPalette(false);
                  }}
                  style={{
                    backgroundColor: THEMES[c.key].bg,
                    borderColor: THEMES[c.key].border
                  }}
                  className="w-5 h-5 rounded-full border-2 hover:scale-110 transition-transform"
                />
              ))}
            </div>
          )}
        </NodeToolbar>
      )}

      {/* NODE BODY */}
      <div
        onDoubleClick={handleDoubleClick}
        className="px-8 py-4 border transition-all cursor-pointer min-w-[140px] flex items-center justify-center rounded-full"
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.border,
          boxShadow: selected
            ? `0 0 0 1px ${theme.ring}`
            : "none"
        }}
      >
        {isEditing ? (
          <input
            className="bg-transparent border-none outline-none text-center font-semibold w-full nodrag text-gray-100"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <div className="text-gray-100 font-semibold text-sm text-center select-none">
            {label}
          </div>
        )}
      </div>

      {/* HANDLES */}
      <Handle type="target" position={Position.Top} id="t" className="w-1 h-1 !bg-white" />
      <Handle type="source" position={Position.Top} id="ts" className="w-1 h-1 !bg-white opacity-0" />

      <Handle type="target" position={Position.Bottom} id="b" className="w-1 h-1 !bg-white" />
      <Handle type="source" position={Position.Bottom} id="bs" className="w-1 h-1 !bg-white" />

      <Handle type="target" position={Position.Left} id="l" className="w-1 h-1 !bg-white" />
      <Handle type="source" position={Position.Left} id="ls" className="w-1 h-1 !bg-white" />

      <Handle type="target" position={Position.Right} id="r" className="w-1 h-1 !bg-white" />
      <Handle type="source" position={Position.Right} id="rs" className="w-1 h-1 !bg-white" />
    </div>
  );
};

export default EllipseNode;
