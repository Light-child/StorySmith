// flowTypes.js — registers all custom node and edge types for React Flow,
// and defines the initial node that appears on a brand new empty mindmap.
// Import nodeTypes and edgeTypes into MindMapView and pass them to <ReactFlow>.

import EllipseNode   from './nodes/EllipseNode';
import CircleNode    from './nodes/CircleNode';
import RectangleNode from './nodes/RectangleNode';
import ImageNode     from './nodes/ImageNode';
import TableNode     from './nodes/TableNode';
import CustomEdge    from './nodes/CustomEdge';

// React Flow requires these objects to be defined OUTSIDE of the component
// that renders <ReactFlow> — if defined inside, it re-creates them on every
// render and React Flow resets all node positions.
export const nodeTypes = {
  ellipse:   EllipseNode,
  circle:    CircleNode,
  rectangle: RectangleNode,
  image:     ImageNode,
  table:     TableNode,
};

export const edgeTypes = {
  custom: CustomEdge,
};

// The starting node for a brand new mindmap canvas
export const initialNodes = [
  {
    id: '1',
    type: 'ellipse',
    position: { x: 250, y: 5 },
    data: { label: 'Double Click Me' },
  },
];
