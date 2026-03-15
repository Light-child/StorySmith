// useMindMap.js — The mindmap brain hook
// ─────────────────────────────────────────
// This is your original useMindMap hook with two additions:
//
//   1. LOAD: a useEffect watching activeMindMapId that reads the mindmap's
//      stored essence from the Zustand store and initialises allData from it.
//
//   2. SAVE: a useEffect watching allData that debounces a call to
//      persistMindMap, writing the current state to PouchDB.
//
// Everything else (portal navigation, node/edge handlers, proppedNodes,
// proppedEdges, paste, dirty state) is exactly your original code.

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { addEdge, applyNodeChanges, applyEdgeChanges, MarkerType } from 'reactflow';

import { initialNodes } from './flowTypes';
import useStore from '../../State/useStore';

export function useMindMap() {
  // ── Store connection ──────────────────────────────────────────────────────
  // We read activeMindMapId and mindmaps to know what to load,
  // and persistMindMap to save changes back to PouchDB.
  const activeMindMapId = useStore((s) => s.activeMindMapId);
  const mindmaps        = useStore((s) => s.mindmaps);
  const persistMindMap  = useStore((s) => s.persistMindMap);

  // Keep persistMindMap in a ref so the debounced save effect never
  // goes stale (same pattern used in NoteEditor).
  const persistRef = useRef(persistMindMap);
  useEffect(() => { persistRef.current = persistMindMap; }, [persistMindMap]);

  // ── Core state (your original) ────────────────────────────────────────────
  const [allData, setAllData] = useState({ root: { nodes: initialNodes, edges: [] } });
  const [path, setPath]       = useState([{ id: 'root', name: 'Home' }]);
  const [isDirty, setIsDirty] = useState(false);

  // ── ADDITION 1: Load from PouchDB when the active mindmap changes ─────────
  // When the user selects a different mindmap in the sidebar, this effect
  // reads its stored essence and reinitialises allData and path.
  useEffect(() => {
    if (!activeMindMapId) {
      // No mindmap selected — reset to empty canvas
      setAllData({ root: { nodes: initialNodes, edges: [] } });
      setPath([{ id: 'root', name: 'Home' }]);
      setIsDirty(false);
      return;
    }

    // Find the mindmap document in the store's in-memory array
    const mindmap = mindmaps.find((m) => m.mindmap_id === activeMindMapId);
    if (!mindmap) return;

    const stored = mindmap.essence;

    // essence should be { root: { nodes, edges }, [portalId]: { nodes, edges }, ... }
    // Validate it has at least a root level; fall back to empty if corrupted.
    if (stored && typeof stored === 'object' && stored.root) {
      setAllData(stored);
    } else {
      setAllData({ root: { nodes: initialNodes, edges: [] } });
    }

    // Reset navigation to the root level of the newly loaded map
    setPath([{ id: 'root', name: 'Home' }]);
    setIsDirty(false);
  }, [activeMindMapId]); // intentionally excludes mindmaps to avoid re-running on every save

  // ── ADDITION 2: Auto-save to PouchDB when allData changes ─────────────────
  // Debounced 2s after the last change — same pattern as NoteEditor.
  // isDirty guards against saving on the initial load (which sets allData
  // from PouchDB, not from user interaction).
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!activeMindMapId || !isDirty) return;

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // allData is the full multi-level object including portal sub-canvases.
      // We store the whole thing as the mindmap's essence.
      persistRef.current(activeMindMapId, allData);
    }, 2000);

    return () => clearTimeout(saveTimer.current);
  }, [allData, activeMindMapId, isDirty]);

  // ── Helpers (your original) ───────────────────────────────────────────────
  const currentLevelId = path[path.length - 1]?.id || 'root';

  const currentView = useMemo(() =>
    allData[currentLevelId] || { nodes: [], edges: [] },
  [allData, currentLevelId]);

  // ── Node & edge change handlers (your original) ───────────────────────────
  const onNodesChange = useCallback((changes) => {
    setAllData((prev) => ({
      ...prev,
      [currentLevelId]: {
        ...prev[currentLevelId],
        nodes: applyNodeChanges(changes, prev[currentLevelId].nodes),
      }
    }));
  }, [currentLevelId]);

  const onEdgesChange = useCallback((changes) => {
    setAllData((prev) => ({
      ...prev,
      [currentLevelId]: {
        ...prev[currentLevelId],
        edges: applyEdgeChanges(changes, prev[currentLevelId].edges),
      }
    }));
  }, [currentLevelId]);

  const onConnect = useCallback((params) => {
    setAllData(prev => ({
      ...prev,
      [currentLevelId]: {
        ...prev[currentLevelId],
        edges: addEdge({
          ...params,
          type: 'custom',
          data: { label: '', color: '#b1b1b7', lineType: 'curved' }
        }, prev[currentLevelId].edges)
      }
    }));
  }, [currentLevelId]);

  const onEdgeLabelChange = useCallback((edgeId, newLabel) => {
    setAllData((prev) => ({
      ...prev,
      [currentLevelId]: {
        ...prev[currentLevelId],
        edges: prev[currentLevelId].edges.map((e) =>
          e.id === edgeId ? { ...e, data: { ...e.data, label: newLabel } } : e
        ),
      },
    }));
  }, [currentLevelId]);

  const onEdgeColorChange = useCallback((edgeId, newColor) => {
    setAllData((prev) => ({
      ...prev,
      [currentLevelId]: {
        ...prev[currentLevelId],
        edges: prev[currentLevelId].edges.map((e) =>
          e.id === edgeId ? { ...e, data: { ...e.data, color: newColor } } : e
        ),
      },
    }));
  }, [currentLevelId]);

  const onLineTypeChange = useCallback((edgeId, type) => {
    setAllData((prev) => {
      const currentLevel = prev[currentLevelId];
      if (!currentLevel) return prev;

      const updatedEdges = currentLevel.edges.map((edge) => {
        if (edge.id === edgeId) {
          const currentColor = edge.data?.color || '#b1b1b7';
          const hasArrowEnd   = type?.includes('arrow-end')   || type?.includes('arrow-both');
          const hasArrowStart = type?.includes('arrow-start') || type?.includes('arrow-both');

          const updatedEdge = { ...edge, data: { ...edge.data, lineType: type } };

          if (hasArrowEnd)   updatedEdge.markerEnd   = { type: MarkerType.ArrowClosed, color: currentColor };
          else               delete updatedEdge.markerEnd;

          if (hasArrowStart) updatedEdge.markerStart = { type: MarkerType.ArrowClosed, color: currentColor };
          else               delete updatedEdge.markerStart;

          return updatedEdge;
        }
        return edge;
      });

      return { ...prev, [currentLevelId]: { ...currentLevel, edges: updatedEdges } };
    });
  }, [currentLevelId]);

  const onLabelChange = useCallback((id, newValue) => {
    setAllData((prev) => {
      const currentLevel = prev[currentLevelId];
      if (!currentLevel) return prev;

      const isTable = typeof newValue === 'object' && newValue !== null;
      const updatedNodes = currentLevel.nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...(isTable ? { tableData: newValue } : { label: newValue })
            }
          };
        }
        return node;
      });

      return { ...prev, [currentLevelId]: { ...currentLevel, nodes: updatedNodes } };
    });
  }, [currentLevelId]);

  // ── Portal navigation (your original) ────────────────────────────────────
  const enterPortal = useCallback((nodeId, nodeLabel) => {
    setAllData(prev => {
      const updated = { ...prev };
      updated[currentLevelId].nodes = updated[currentLevelId].nodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, isPortal: true } } : n
      );
      if (!updated[nodeId]) {
        updated[nodeId] = {
          nodes: [{
            id: `ref-${nodeId}`,
            type: 'ellipse',
            position: { x: 250, y: 200 },
            data: { label: nodeLabel, isReference: true },
            draggable: false
          }],
          edges: []
        };
      }
      return updated;
    });
    setPath(prev => [...prev, { id: nodeId, name: nodeLabel }]);
  }, [currentLevelId]);

  const goBack = useCallback(() => {
    if (path.length <= 1) return;
    setPath(prev => prev.slice(0, -1));
  }, [path]);

  // ── Add node (your original) ──────────────────────────────────────────────
  const addNode = useCallback((type) => {
    const id = `${type}_${Date.now()}`;
    const newNode = {
      id,
      type,
      position: { x: 150, y: 150 },
      data: {
        label: type === 'table' ? '' : `New ${type}`,
        tableData: type === 'table'
          ? { headers: ['Header 1', 'Header 2'], rows: [['', '']] }
          : null,
        onLabelChange,
        enterPortal,
        onEdgesChange,
      },
      style: type === 'table' ? { width: 300, height: 200 } : {}
    };

    setAllData((prev) => ({
      ...prev,
      [currentLevelId]: {
        ...prev[currentLevelId],
        nodes: [...prev[currentLevelId].nodes, newNode]
      }
    }));
  }, [currentLevelId, enterPortal, onLabelChange, onEdgesChange]);

  const onEdgeDelete = useCallback((edgeId) => {
    setAllData((prev) => ({
      ...prev,
      [currentLevelId]: {
        ...prev[currentLevelId],
        edges: prev[currentLevelId].edges.filter((e) => e.id !== edgeId),
      },
    }));
  }, [currentLevelId]);

  // ── Propped nodes & edges (your original) ─────────────────────────────────
  // Injects live callbacks into node data so nodes can communicate back up.
  const proppedNodes = useMemo(() => {
    return currentView.nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        enterPortal,
        onDelete: (id) => setAllData(prev => {
          const nodeToDelete = prev[currentLevelId].nodes.find(n => n.id === id);
          if (nodeToDelete?.data?.isReference) return prev;
          const newData = { ...prev };
          newData[currentLevelId].nodes = newData[currentLevelId].nodes.filter(n => n.id !== id);
          return newData;
        }),
        onLabelChange: (id, newValue) => {
          setAllData((prev) => {
            const newData = { ...prev };
            const currentLevel = newData[currentLevelId];
            if (!currentLevel) return prev;

            const isTable = typeof newValue === 'object' && newValue !== null;
            currentLevel.nodes = currentLevel.nodes.map((n) => {
              if (n.id === id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    ...(isTable ? { tableData: newValue } : { label: newValue })
                  }
                };
              }
              return n;
            });

            // Sync portal reference label
            if (!isTable && newData[id]) {
              newData[id].nodes = newData[id].nodes.map((n) =>
                n.data.isReference ? { ...n, data: { ...n.data, label: newValue } } : n
              );
            }

            return newData;
          });

          if (typeof newValue === 'string') {
            setPath((prevPath) =>
              prevPath.map((step) => (step.id === id ? { ...step, name: newValue } : step))
            );
          }
        },
        onChangeColor: (id, bgColor) => setAllData(prev => ({
          ...prev,
          [currentLevelId]: {
            ...prev[currentLevelId],
            nodes: prev[currentLevelId].nodes.map(n =>
              n.id === id ? { ...n, data: { ...n.data, bgColor } } : n
            )
          }
        })),
      }
    }));
  }, [currentView.nodes, currentLevelId, enterPortal]);

  const proppedEdges = useMemo(() => {
    return currentView.edges.map((edge) => {
      const proppedEdge = {
        ...edge,
        data: {
          ...edge.data,
          onEdgeLabelChange,
          onEdgeColorChange,
          onLineTypeChange,
          onEdgeDelete,
        },
      };
      if (edge.markerEnd)   proppedEdge.markerEnd   = edge.markerEnd;
      if (edge.markerStart) proppedEdge.markerStart = edge.markerStart;
      return proppedEdge;
    });
  }, [currentView.edges, onEdgeLabelChange, onEdgeColorChange, onLineTypeChange, onEdgeDelete]);

  // ── Effects (your original) ───────────────────────────────────────────────

  // Paste image from clipboard
  useEffect(() => {
    const handlePaste = (event) => {
      const items = (event.clipboardData || event.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (e) => {
            const id = `image_${Date.now()}`;
            const newNode = {
              id,
              type: 'image',
              position: { x: 200, y: 200 },
              data: { url: e.target.result },
              style: { width: 300, height: 200 }
            };
            setAllData(prev => {
              const currentLevelData = prev[currentLevelId] || { nodes: [], edges: [] };
              return {
                ...prev,
                [currentLevelId]: {
                  ...currentLevelData,
                  nodes: [...currentLevelData.nodes, newNode]
                }
              };
            });
          };
          reader.readAsDataURL(file);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [currentLevelId]);

  // Mark dirty whenever allData changes
  useEffect(() => {
    if (Object.keys(allData).length > 0) setIsDirty(true);
  }, [allData]);

  // Warn before unload if unsaved (only relevant outside Tauri)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return {
    allData,
    currentView,
    path,
    isDirty,
    onNodesChange,
    onEdgesChange,
    addNode,
    onConnect,
    enterPortal,
    goBack,
    onEdgeLabelChange,
    onEdgeColorChange,
    onLineTypeChange,
    onEdgeDelete,
    onLabelChange,
    proppedNodes,
    proppedEdges,
    setIsDirty,
    setAllData,
    setPath,
  };
}
