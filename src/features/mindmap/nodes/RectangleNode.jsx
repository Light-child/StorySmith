// nodes/RectangleNode.jsx — Attribute/list node (rectangle shape)
// Uses contentEditable for rich inline editing.

import React, { useRef, useState, useEffect } from 'react';
import { Handle, Position, NodeToolbar} from 'reactflow';
import { THEMES } from "../themes";

const RectangleNode = ({ data, id, selected }) => {
  const editorRef = useRef(null);
  const isReference = data.isReference;
  const [showPalette, setShowPalette] = useState(false);

  // Sync the contentEditable div when global state changes (e.g. portal sync)
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
    {name: "Classical", key: "classical"}
  ];

  return (
    <div
      className={`flex flex-col shadow-xl rounded-md transition-all
        ${selected ? 'ring-2 ring-blue-500 shadow-2xl' : 'shadow-md'}
        ${isReference ? 'opacity-90' : ''}`}
      style={{
        minWidth: '150px',
        minHeight: '150px',
        maxWidth: '250px',
        padding: '15px',
        height: 'auto',
        backgroundColor: '#252525',
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

            {/* <button
              onClick={() => setShowPalette(!showPalette)}
              className="p-1 rounded text-xs nodrag text-gray-300 hover:bg-gray-800"
              title="Choose Color"
            >
              🎨
            </button> */}
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
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-blue-500 border-2 border-white" />

      <div className="p-3 flex flex-col h-full">
        <div
          ref={editorRef}
          contentEditable={!isReference}
          onInput={handleInput}
          className="nodrag nowheel outline-none text-white text-base font-sans block h-full whitespace-normal text-sm text-left cursor-text"
          placeholder="Type here..."
        />
      </div>

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

export default RectangleNode;
