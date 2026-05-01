// MindMapView.jsx — Main mindmap editing canvas
// ────────────────────────────────────────────────
// Changes from previous version:
//   - Removed portal path/breadcrumb/goBack (replaced by D-node navigation)
//   - Added DNodePanel (right sidebar) toggled via MindMapToolbar
//   - Added onDrop handler to accept D-nodes dragged from DNodePanel
//   - Passes rfInstance to ReactFlow for programmatic pan/zoom

import React, { useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';

import { useMindMap }                   from './useMindMap';
import { nodeTypes, edgeTypes }         from './flowTypes';
import { exportToJson, importFromJson } from './fileStorage';
import MindMapToolbar                   from './MindMapToolbar';
import DNodePanel                       from './DNodePanel';
import useStore                         from '../../State/useStore';
import styles                           from './MindMapView.module.css';

// Wrap in ReactFlowProvider so useReactFlow() works inside child components
function MindMapCanvas() {
  const activeMindMapId  = useStore((s) => s.activeMindMapId);
  const mindmaps         = useStore((s) => s.mindmaps);
  const dNodeMindMaps    = useStore((s) => s.dNodeMindMaps);
  const dnodePanelOpen   = useStore((s) => s.dnodePanelOpen);
  const openDNodePanel   = useStore((s) => s.openDNodePanel);
  const closeDNodePanel  = useStore((s) => s.closeDNodePanel);

  // Find active mindmap in either regular or D-node lists
  const activeMindMap =
    mindmaps.find((m) => m.mindmap_id === activeMindMapId) ||
    dNodeMindMaps.find((m) => m.mindmap_id === activeMindMapId);

  const isDNodeMindMap = activeMindMap?.is_dnode ?? false;

  const {
    proppedNodes, proppedEdges,
    onNodesChange, onEdgesChange, onConnect,
    addNode, placeDNode, isDirty,
    setIsDirty, setNodes, setEdges, rfInstance,
  } = useMindMap();

  // File export/import (kept as backup alongside PouchDB)
  const allData = { nodes: proppedNodes, edges: proppedEdges };
  const handleExport = () => { exportToJson(allData); setIsDirty(false); };
  const handleImport = (e) => {
    importFromJson(e, {
      allData,
      setAllData: ({ nodes, edges }) => { setNodes(nodes); setEdges(edges); },
      setPath: () => {},
      setIsDirty,
    });
  };

  // ── D-node drop handler ───────────────────────────────────────────────────
  // Fired when the user drops a dragged item from DNodePanel onto the canvas.
  const reactFlowWrapper = useRef(null);

  const onDrop = useCallback(async (event) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/storysmith-dnode');
    if (!raw) return;

    const payload = JSON.parse(raw);

    // Convert screen coordinates to React Flow canvas coordinates
    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    const position = rfInstance.current
      ? rfInstance.current.screenToFlowPosition({
          x: event.clientX - (bounds?.left ?? 0),
          y: event.clientY - (bounds?.top  ?? 0),
        })
      : { x: event.clientX - 200, y: event.clientY - 100 };

    await placeDNode(payload, position);
  }, [placeDNode, rfInstance]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!activeMindMapId) {
    return (
      <div className={styles.empty}>
        <p>Select a mind map from the sidebar, or create a new one.</p>
        <p className={styles.emptyHint}>Use the ＋ button next to MindMap in the sidebar.</p>
      </div>
    );
  }

  return (
    <div className={styles.root}>

      {/* Header: map name + D-node indicator + unsaved dot */}
      <div className={styles.header}>
        <span className={styles.mapName}>{activeMindMap?.mindmap_name}</span>
        {isDNodeMindMap && (
          <span className={styles.dnodeBadge}>D-NODE MINDMAP</span>
        )}
        {isDirty && <span className={styles.unsaved}>● unsaved</span>}
      </div>

      {/* Canvas + optional D-node panel */}
      <div className={styles.canvasRow}>

        {/* React Flow canvas */}
        <div
          className={styles.canvas}
          ref={reactFlowWrapper}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          {/* Node-adding toolbar (top-right) */}
          <MindMapToolbar
            onAddNode={addNode}
            onExport={handleExport}
            onImport={handleImport}
            onOpenDNodePanel={openDNodePanel}
          />

          <ReactFlow
            nodes={proppedNodes}
            edges={proppedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={(instance) => { rfInstance.current = instance; }}

            fitView
            deleteKeyCode="Delete"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--text-muted, #555)" gap={24} size={1} variant="dots" />
            <Controls
              style={{
                background:   'var(--bg-elevated, #242424)',
                border:       '1px solid var(--border, rgba(255,255,255,0.07))',
                borderRadius: '8px',
              }}
            />
          </ReactFlow>
        </div>

        {/* D-node picker panel — slides in from the right */}
        {dnodePanelOpen && (
          <DNodePanel
            onClose={closeDNodePanel}
            onPlaceDNode={placeDNode}
          />
        )}

      </div>
    </div>
  );
}

export default function MindMapView() {
  return (
    <ReactFlowProvider>
      <MindMapCanvas />
    </ReactFlowProvider>
  );
}