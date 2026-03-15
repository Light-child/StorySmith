// nodes/ImageNode.jsx — Displays a pasted/imported image inside a resizable node

import React from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';

const ImageNode = ({ data, selected }) => {
  return (
    <div className={`relative bg-white rounded-lg shadow-lg overflow-hidden border-2 ${selected ? 'border-blue-500' : 'border-transparent'}`}>
      <NodeResizer color="#3b82f6" isVisible={selected} minWidth={100} minHeight={100} />
      <Handle type="target" position={Position.Top}    className="opacity-0" />
      <div className="w-full h-full flex items-center justify-center">
        <img src={data.url} alt="Pasted content" className="w-full h-full object-contain pointer-events-none" />
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};

export default ImageNode;
