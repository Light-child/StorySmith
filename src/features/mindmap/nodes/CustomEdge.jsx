// CustomEdge.jsx — Editable edge with colour, line type, arrow, and label support.
// Lives alongside node components since it's a React Flow custom type.

import React, { useState, useEffect } from 'react';
import { getBezierPath, getStraightPath, EdgeLabelRenderer } from 'reactflow';

export default function CustomEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  style = {}, markerEnd, markerStart, data, selected
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || '');
  const [prevLabel, setPrevLabel] = useState(data.label || '');

  // Sync label if it changes externally (e.g. after import)
  useEffect(() => {
    setLabel(data.label || '');
    setPrevLabel(data.label || '');
  }, [data.label]);

  const isStraight = data.lineType?.includes('straight');
  const [edgePath, labelX, labelY] = isStraight
    ? getStraightPath({ sourceX, sourceY, targetX, targetY })
    : getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const handleBlur = () => {
    setIsEditing(false);
    if (data?.onEdgeLabelChange) data.onEdgeLabelChange(id, label);
    if (label.trim() === '') {
      setLabel(prevLabel);
    } else {
      setPrevLabel(label);
    }
  };

  const clearLabel = () => {
    setLabel('');
    setPrevLabel('');
    if (data.onEdgeLabelChange) data.onEdgeLabelChange(id, '');
  };

  return (
    <>
      {/* Visible path */}
      <path
        id={id}
        style={{
          ...style,
          stroke: data?.color || '#b1b1b7',
          strokeWidth: 2,
          strokeDasharray: data?.lineType?.includes('dashed') ? '5,5' : '0'
        }}
        className="react-flow__edge-path cursor-pointer"
        d={edgePath}
        markerEnd={data.markerEnd || markerEnd}
        markerStart={data.markerStart || markerStart}
      />

      {/* Invisible wider path for easier clicking */}
      <path d={edgePath} fill="none" strokeOpacity={0} strokeWidth={20} className="cursor-pointer" />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex flex-col items-center gap-2"
        >
          {/* Edge toolbar — shown when edge is selected */}
          {selected && (
            <div className="flex items-center gap-1 bg-white p-1 shadow-xl rounded-lg border border-gray-200 mb-2">
              <button onClick={clearLabel} className="p-1 hover:bg-gray-100 rounded text-xs" title="Clear Label">Empty</button>

              <button
                onClick={() => {
                  const colors = ['#3b82f6', '#a855f7', '#22c55e', '#eab308', '#ef4444', '#b1b1b7'];
                  const next = colors[(colors.indexOf(data.color || '#b1b1b7') + 1) % colors.length];
                  data.onEdgeColorChange(id, next);
                }}
                className="p-1 hover:bg-gray-100 rounded text-xs"
              >
                🎨
              </button>

              <select
                className="text-[10px] border rounded bg-gray-50 px-1"
                onChange={(e) => data.onLineTypeChange(id, e.target.value)}
                value={data.lineType || 'curved'}
              >
                <option value="curved">Curved</option>
                <option value="curved-dashed">C-Dash</option>
                <option value="straight-dashed">S-Dash</option>
                <option value="arrow-end">Arrow End</option>
                <option value="arrow-start">Arrow Start</option>
                <option value="arrow-both">Two Way</option>
              </select>

              <button
                onClick={() => data.onEdgeDelete && data.onEdgeDelete(id)}
                className="p-1 hover:bg-red-100 rounded text-xs ml-1"
                title="Delete Edge"
              >
                🗑️
              </button>
            </div>
          )}

          {/* Label */}
          {isEditing ? (
            <input
              autoFocus
              className="bg-white border border-blue-500 rounded px-1 text-[10px] outline-none shadow-sm w-24 text-center"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            />
          ) : (
            label && (
              <div
                onDoubleClick={() => setIsEditing(true)}
                className="bg-white px-2 py-0.5 rounded shadow-sm border border-gray-200 text-[10px] font-medium text-gray-700 cursor-pointer"
              >
                {label}
              </div>
            )
          )}

          {/* Hidden click target for empty labels */}
          {!label && !isEditing && (
            <div onDoubleClick={() => setIsEditing(true)} className="w-8 h-4 bg-transparent cursor-pointer" />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
