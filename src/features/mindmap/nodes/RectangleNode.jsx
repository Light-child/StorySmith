// nodes/RectangleNode.jsx — Attribute/list node (rectangle shape)
// Uses contentEditable for rich inline editing.

import React, { useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

const RectangleNode = ({ data, id, selected }) => {
  const editorRef = useRef(null);
  const isReference = data.isReference;

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

  return (
    <div
      className={`flex flex-col shadow-xl rounded-md transition-all
        ${selected ? 'ring-2 ring-blue-500 shadow-2xl' : 'shadow-md'}
        ${isReference ? 'opacity-90' : ''}`}
      style={{
        minWidth: '150px',
        maxWidth: '250px',
        height: 'auto',
        backgroundColor: '#252525',
      }}
    >
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
