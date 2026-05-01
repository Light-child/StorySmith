// flowTypes.js — registers all custom node and edge types for React Flow.
// IMPORTANT: these objects must be defined outside of any component —
// if defined inside a render function, React Flow resets node positions
// on every render.

import EllipseNode       from './nodes/EllipseNode';
import CircleNode        from './nodes/CircleNode';
import RectangleNode     from './nodes/RectangleNode';
import ImageNode         from './nodes/ImageNode';
import TableNode         from './nodes/TableNode';
import DNodeNode         from './nodes/DNodeNode';         // D-node instance
import DNodeTrackerNode  from './nodes/DNodeTrackerNode';  // tracker inside D-node mindmap
import CustomEdge        from './nodes/CustomEdge';

export const nodeTypes = {
  ellipse:      EllipseNode,
  circle:       CircleNode,
  rectangle:    RectangleNode,
  image:        ImageNode,
  table:        TableNode,
  dnode:        DNodeNode,         // appears in regular mindmaps
  dnode_tracker: DNodeTrackerNode, // appears inside D-node mindmaps
};

export const edgeTypes = {
  custom: CustomEdge,
};

// Starting node for a brand new regular mindmap
export const initialNodes = [
  {
    id:       '1',
    type:     'ellipse',
    position: { x: 250, y: 5 },
    data:     { label: 'Double Click Me' },
  },
];