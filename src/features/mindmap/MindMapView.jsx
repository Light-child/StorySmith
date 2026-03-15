// MindMapView.jsx — The mind map editing canvas

import React from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';

import { useMindMap }                    from './useMindMap';
import { nodeTypes, edgeTypes }          from './flowTypes';
import { exportToJson, importFromJson }  from './fileStorage';
import MindMapToolbar                    from './MindMapToolbar';
import useStore                          from '../../State/useStore';
import styles                            from './MindMapView.module.css';

export default function MindMapView() {
  const activeMindMapId = useStore((s) => s.activeMindMapId);
  const mindmaps        = useStore((s) => s.mindmaps);
  const activeMindMap   = mindmaps.find((m) => m.mindmap_id === activeMindMapId);

  const {
    allData, proppedNodes, proppedEdges,
    onNodesChange, onEdgesChange, onConnect,
    addNode, path, goBack, isDirty,
    setIsDirty, setAllData, setPath,
  } = useMindMap();

  const handleExport = () => { exportToJson(allData); setIsDirty(false); };
  const handleImport = (e)  => importFromJson(e, { allData, setAllData, setPath, setIsDirty });

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!activeMindMapId) {
    return (
      <div className={styles.empty}>
        <p>Select a mind map from the sidebar, or create a new one.</p>
        <p className={styles.emptyHint}>Use the ＋ button next to MindMap in the sidebar.</p>
      </div>
    );
  }

  // ── Canvas ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.root}>

      {/* Header: map name, portal breadcrumbs, unsaved indicator */}
      <div className={styles.header}>
        <span className={styles.mapName}>{activeMindMap?.mindmap_name}</span>
        <span className={styles.breadcrumb}>
          {path.map((p, i) => (i === 0 ? 'HOME' : p.name)).join(' / ')}
        </span>
        {path.length > 1 && (
          <button onClick={goBack} className={styles.backBtn}>← Back</button>
        )}
        {isDirty && <span className={styles.unsaved}>● unsaved</span>}
      </div>

      {/* React Flow canvas — MindMapToolbar floats inside it */}
      <div className={styles.canvas}>
        <MindMapToolbar
          onAddNode={addNode}
          onExport={handleExport}
          onImport={handleImport}
        />

        <ReactFlow
          nodes={proppedNodes}
          edges={proppedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          snapToHandle={true}
          fitView
          deleteKeyCode="Delete"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--text-muted, #555)" gap={24} size={1} variant="dots" />
          <Controls
            style={{
              background: 'var(--bg-elevated, #242424)',
              border: '1px solid var(--border, rgba(255,255,255,0.07))',
              borderRadius: '8px',
            }}
          />
        </ReactFlow>
      </div>

    </div>
  );
}