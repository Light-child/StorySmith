// nodes/ImageNode.jsx — Displays a pasted/imported image inside a resizable node

import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, NodeToolbar } from 'reactflow';
import { THEMES } from "../themes";

const ImageNode = ({ id, data, selected }) => {
  const editorRef = useRef(null);
  const isReference = data.isReference;
  const [showPalette, setShowPalette] = useState(false);

  // Sync the contentEditable div when global state changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== data.label) {
      editorRef.current.innerHTML = data.label || '';
    }
  }, [data.label]);

  const handleInput = () => {
    if (data.onLabelChange) {
      data.onLabelChange(id, editorRef.current.innerHTML);
    }
  };

  // Resolve theme
  const themeKey = data.bgColor || "classical";
  const theme = THEMES[themeKey];

  const colors = [
    { name: "Blue", key: "blue" },
    { name: "Purple", key: "purple" },
    { name: "Green", key: "green" },
    { name: "Yellow", key: "yellow" },
    { name: "Red", key: "red" },
    { name: "Classical", key: "classical" }
  ];

  const hasLabel = data.label && data.label.trim() !== '';
  const showLabelArea = selected || hasLabel;

  return (
    <div
      className={`relative  shadow-lg overflow-hidden border-2 w-full transition-all flex flex-col h-auto
        ${selected ? 'ring-2 ring-white-500 shadow-2xl' : ''}
        ${isReference ? 'opacity-90' : ''}`}
      style={{
        backgroundColor: theme.bg,
        borderColor: selected ? 'transparent' : theme.border,
      }}
    >
       {/* TOOLBAR */}
      {!isReference && (
        <NodeToolbar
          isVisible={data.forceToolbar || selected}
          position={Position.Right}
          className="flex flex-col gap-2 bg-gray-900 p-2 shadow-xl rounded-lg border border-gray-700"
        >
          <div className="flex gap-2">
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

      <NodeResizer
        color="#3b82f6"
        isVisible={selected}
        minWidth={100}
        keepAspectRatio={true}
      />

      <Handle type="target" position={Position.Top} className="opacity-0" />

      {/* Image Container — uses w-full h-auto to maintain ratio naturally */}
      <div className="w-full h-auto leading-[0]">
        <img
          src={data.url}
          alt="Pasted content"
          className="w-full h-auto block pointer-events-none"
        />
      </div>

      {/* Editable Label Area — flush with image, grows with content */}
      {showLabelArea && (
        <div className="px-3 py-3 flex flex-col">
          <div
            ref={editorRef}
            contentEditable={!isReference}
            onInput={handleInput}
            className="nodrag nowheel outline-none text-white text-sm font-sans block w-full whitespace-normal text-center cursor-text empty:before:content-[attr(placeholder)] empty:before:text-gray-400 empty:before:italic"
            placeholder="Add caption..."
          />
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

export default ImageNode;
