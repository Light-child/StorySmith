// nodes/CircleNode.jsx — Character node (circle shape)
// Presentational only. All state changes go up via data.onLabelChange.

import { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

const CircleNode = ({ data, id, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || 'New Character');

  // Sync with global state changes (e.g. when portal label updates propagate down)
  useEffect(() => {
    setLabel(data.label);
  }, [data.label]);

  const handleBlur = () => {
    setIsEditing(false);
    if (data.onLabelChange) data.onLabelChange(id, label);
  };

  return (
    <div className="relative p-1">
      <div
        className={`w-[100px] h-[100px] bg-purple-50 border-2 transition-all cursor-pointer 
          flex items-center justify-center rounded-full overflow-hidden
          ${selected ? 'border-purple-700 ring-2 ring-purple-200' : 'border-purple-500'}
          hover:shadow-md hover:border-purple-600`}
        onDoubleClick={() => setIsEditing(true)}
      >
        {isEditing ? (
          <input
            className="bg-transparent border-none outline-none text-center text-purple-900 font-semibold w-full px-2 nodrag"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            autoFocus
          />
        ) : (
          <div className="text-purple-900 font-semibold text-xs text-center select-none px-2 break-words">
            {label}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Top}    className="!bg-purple-600 !w-3 !h-3 !border-white z-10" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-600 !w-3 !h-3 !border-white z-10" />
      <Handle type="target" position={Position.Left}   className="!bg-purple-600 !w-3 !h-3 !border-white z-10" />
      <Handle type="source" position={Position.Right}  className="!bg-purple-600 !w-3 !h-3 !border-white z-10" />
    </div>
  );
};

export default CircleNode;
