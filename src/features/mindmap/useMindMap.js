// useMindMap.js — Mindmap brain hook
// ────────────────────────────────────
// Portal system replaced by D-nodes:
//   enterPortal  → enterDNode(dnodeMindmapId)
//   isPortal     → isDNode (on node data)
//   allData sub-canvas levels → separate PouchDB mindmap records
//
// allData is now flat: { nodes: [], edges: [] } for the current mindmap only.
// Navigating "into" a D-node just switches activeMindMapId in the store.

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { addEdge, applyNodeChanges, applyEdgeChanges, MarkerType } from 'reactflow';

import { initialNodes } from './flowTypes';
import useStore from '../../State/useStore';

export function useMindMap() {
  // ── Store ─────────────────────────────────────────────────────────────────
  const activeMindMapId    = useStore((s) => s.activeMindMapId);
  const mindmaps           = useStore((s) => s.mindmaps);
  const dNodeMindMaps      = useStore((s) => s.dNodeMindMaps);
  const persistMindMap     = useStore((s) => s.persistMindMap);
  const addDNode           = useStore((s) => s.addDNode);
  const registerDNodeInMindmap   = useStore((s) => s.registerDNodeInMindmap);
  const unregisterDNodeFromMindmap = useStore((s) => s.unregisterDNodeFromMindmap);
  const selectDNodeMindMap = useStore((s) => s.selectDNodeMindMap);
  const selectMindMap      = useStore((s) => s.selectMindMap);
  const selectNote         = useStore((s) => s.selectNote);

  // Keep persistMindMap in a ref so debounced saves never go stale
  const persistRef = useRef(persistMindMap);
  useEffect(() => { persistRef.current = persistMindMap; }, [persistMindMap]);

  // ── Local state — flat: just nodes + edges for the current mindmap ───────
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isDirty, setIsDirty] = useState(false);

  // ── React Flow ref for programmatic pan/zoom (used by tracker go-to) ─────
  const rfInstance = useRef(null);

  // ── LOAD: when activeMindMapId changes, load its content ─────────────────
  useEffect(() => {
    if (!activeMindMapId) {
      setNodes(initialNodes);
      setEdges([]);
      setIsDirty(false);
      return;
    }

    // Check regular mindmaps first, then D-node mindmaps
    const mm =
      mindmaps.find((m) => m.mindmap_id === activeMindMapId) ||
      dNodeMindMaps.find((m) => m.mindmap_id === activeMindMapId);

    if (!mm) return;

    const stored = mm.essence;
    if (stored && typeof stored === 'object') {
      setNodes(stored.nodes || initialNodes);
      setEdges(stored.edges || []);
    } else {
      setNodes(initialNodes);
      setEdges([]);
    }
    setIsDirty(false);
  }, [activeMindMapId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SAVE: debounced 2s after any change ──────────────────────────────────
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!activeMindMapId || !isDirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistRef.current(activeMindMapId, { nodes, edges });
    }, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [nodes, edges, activeMindMapId, isDirty]);

  // ───────────────────────────────────────────────────────────────────────────
  // NODE & EDGE CHANGE HANDLERS
  // ───────────────────────────────────────────────────────────────────────────

  const onNodesChange = useCallback((changes) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
    setIsDirty(true);
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
    setIsDirty(true);
  }, []);

  const onConnect = useCallback((params) => {
    setEdges((prev) => addEdge({
      ...params,
      type: 'custom',
      data: { label: '', color: '#b1b1b7', lineType: 'curved' },
    }, prev));
    setIsDirty(true);
  }, []);

  // ── Edge data updates ─────────────────────────────────────────────────────
  const onEdgeLabelChange = useCallback((edgeId, newLabel) => {
    setEdges((prev) => prev.map((e) =>
      e.id === edgeId ? { ...e, data: { ...e.data, label: newLabel } } : e
    ));
    setIsDirty(true);
  }, []);

  const onEdgeColorChange = useCallback((edgeId, newColor) => {
    setEdges((prev) => prev.map((e) =>
      e.id === edgeId ? { ...e, data: { ...e.data, color: newColor } } : e
    ));
    setIsDirty(true);
  }, []);

  const onLineTypeChange = useCallback((edgeId, type) => {
    setEdges((prev) => prev.map((edge) => {
      if (edge.id !== edgeId) return edge;
      const currentColor  = edge.data?.color || '#b1b1b7';
      const hasArrowEnd   = type?.includes('arrow-end')   || type?.includes('arrow-both');
      const hasArrowStart = type?.includes('arrow-start') || type?.includes('arrow-both');
      const updated = { ...edge, data: { ...edge.data, lineType: type } };
      if (hasArrowEnd)   updated.markerEnd   = { type: MarkerType.ArrowClosed, color: currentColor };
      else               delete updated.markerEnd;
      if (hasArrowStart) updated.markerStart = { type: MarkerType.ArrowClosed, color: currentColor };
      else               delete updated.markerStart;
      return updated;
    }));
    setIsDirty(true);
  }, []);

  const onEdgeDelete = useCallback((edgeId) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    setIsDirty(true);
  }, []);

  // ── Label / table change ──────────────────────────────────────────────────
  const onLabelChange = useCallback((id, newValue) => {
    const isTable = typeof newValue === 'object' && newValue !== null;
    setNodes((prev) => prev.map((n) => {
      if (n.id !== id) return n;
      return {
        ...n,
        data: {
          ...n.data,
          ...(isTable ? { tableData: newValue } : { label: newValue }),
        },
      };
    }));
    setIsDirty(true);
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // D-NODE NAVIGATION  (replaces enterPortal / goBack)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * enterDNode — navigate into a D-node's content.
   * If it's linked to a Note, switches to Note view.
   * If it has a mindmap, switches to that mindmap.
   */
  const enterDNode = useCallback((dnodeNodeId) => {
    const { dNodes } = useStore.getState();
    const nodeRec = dNodes.find((d) => d.node_id === dnodeNodeId);
    
    if (nodeRec?.source_type === "note" && nodeRec.source_id) {
      selectNote(nodeRec.source_id, "append");
    } else if (nodeRec?.mind_map_id) {
      selectDNodeMindMap(nodeRec.mind_map_id, "append");
    }
  }, [selectNote, selectDNodeMindMap]);

  /**
   * goBackToMindMap — navigate back to a regular mindmap from a D-node mindmap.
   * Since D-node navigation is just switching activeMindMapId, "back" means
   * selecting whatever mindmap was previously active — handled by the sidebar.
   * This is a convenience to return to the most recent regular mindmap.
   */
  const goBackToMindMap = useCallback(() => {
    const regularMaps = useStore.getState().mindmaps;
    if (regularMaps.length > 0) {
      selectMindMap(regularMaps[0].mindmap_id);
    }
  }, [selectMindMap]);

  // ───────────────────────────────────────────────────────────────────────────
  // D-NODE TRACKER: go-to-host handler
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * goToHostMindmap — called when user double-clicks an appearance block
   * in the tracker node. Navigates to the host mindmap and pans to x/y.
   */
  const goToHostMindmap = useCallback((hostMindmapId, x, y) => {
    // Switch to the host mindmap
    selectMindMap(hostMindmapId);

    // Pan to the D-node's position after a short delay to allow the
    // mindmap to load into the React Flow instance
    setTimeout(() => {
      rfInstance.current?.setCenter(x, y, { zoom: 1, duration: 600 });
    }, 150);
  }, [selectMindMap]);

  // ───────────────────────────────────────────────────────────────────────────
  // ADD NODE (regular types)
  // ───────────────────────────────────────────────────────────────────────────
 
  /**
   * getSpawnPosition — finds a clear position to place a new node.
   *
   * Steps:
   *   1. Start at the center of the user's current viewport using
   *      rfInstance.screenToFlowPosition on the canvas midpoint.
   *   2. Check if any existing node is within MIN_DIST of that position.
   *   3. If blocked, spiral outward in fixed steps until a clear spot is found.
   *
   * @param {object[]} existingNodes — current nodes array
   * @returns {{ x: number, y: number }}
   */
  const getSpawnPosition = useCallback((existingNodes) => {
    // Minimum distance between node centres before we consider them overlapping.
    // 180px covers the widest standard node (ellipse ~140px + margin).
    const MIN_DIST = 180;
 
    // ── 1. Get the canvas viewport centre ──────────────────────────────────
    let center = { x: 300, y: 200 }; // sensible fallback if RF not ready
 
    if (rfInstance.current) {
      const viewport = rfInstance.current.getViewport();
      // The canvas DOM element — we need its pixel dimensions
      const canvasEl = rfInstance.current.getNodes
        ? document.querySelector('.react-flow__renderer')
        : null;
 
      if (canvasEl) {
        const { width, height } = canvasEl.getBoundingClientRect();
        // Convert the pixel centre of the visible area to flow coordinates
        center = rfInstance.current.screenToFlowPosition({
          x: width  / 2,
          y: height / 2,
        });
      } else {
        // Fallback: use viewport transform directly
        // viewport = { x, y, zoom } where x/y is the canvas pan offset
        center = {
          x: (-viewport.x + 400) / viewport.zoom,
          y: (-viewport.y + 300) / viewport.zoom,
        };
      }
    }
 
    // ── 2. Check for overlap at the centre position ────────────────────────
    const isClear = (pos) =>
      existingNodes.every((n) => {
        const dx = (n.position?.x ?? 0) - pos.x;
        const dy = (n.position?.y ?? 0) - pos.y;
        return Math.sqrt(dx * dx + dy * dy) >= MIN_DIST;
      });
 
    if (isClear(center)) return center;
 
    // ── 3. Spiral outward until we find a clear spot ───────────────────────
    // Uses a rectangular spiral: right → down → left → up, growing each lap.
    const STEP = MIN_DIST;
    let x = center.x;
    let y = center.y;
    let step = 1;          // how many moves in the current direction
    let direction = 0;     // 0=right, 1=down, 2=left, 3=up
    const dx = [1, 0, -1,  0];
    const dy = [0, 1,  0, -1];
    let moves = 0;
    let turns = 0;
 
    // Cap iterations to avoid infinite loop on very dense canvases
    for (let i = 0; i < 200; i++) {
      x += dx[direction] * STEP;
      y += dy[direction] * STEP;
      moves++;
 
      if (isClear({ x, y })) return { x, y };
 
      // Spiral turn logic
      if (moves === step) {
        moves = 0;
        direction = (direction + 1) % 4;
        turns++;
        // Every two turns, increase the step length
        if (turns % 2 === 0) step++;
      }
    }
 
    // Last resort — return centre offset by a random amount
    return { x: center.x + Math.random() * 200, y: center.y + Math.random() * 200 };
  }, [rfInstance]);
 
  const addNode = useCallback((type) => {
    // Read current nodes inside the setter to always get latest state
    setNodes((prev) => {
      const position = getSpawnPosition(prev);
      const id = `${type}_${Date.now()}`;
      const newNode = {
        id,
        type,
        position,
        data: {
          label: type === 'table' ? '' : `New ${type}`,
          tableData: type === 'table'
            ? { headers: ['Header 1', 'Header 2'], rows: [['', '']] }
            : null,
        },
        style: type === 'table' ? { width: 300, height: 200 } : {},
      };
      return [...prev, newNode];
    });
    setIsDirty(true);
  }, [getSpawnPosition]);

  // ───────────────────────────────────────────────────────────────────────────
  // PLACE D-NODE  (from DNodePanel drop or click)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * placeDNode — resolves a DNodePanel payload and adds the D-node to the canvas.
   *
   * payload types:
   *   dnode_existing           — reuse an existing D-node record
   *   dnode_new_from_mindmap   — create a new D-node using a mindmap's name
   *   dnode_new_from_note      — create a new D-node using a note's name
   *
   * @param {object} payload  — from DNodePanel's drag/click data
   * @param {{ x: number, y: number }} position — where to place it on canvas
   */
  const placeDNode = useCallback(async (payload, position) => {
    if (!activeMindMapId) return;

    // ── Validation: Prevent circular references ─────────────────────────────
    // A D-node cannot be added to the mindmap it represents (sourceId)
    // or into its own private D-node mindmap (dnodeMindmapId).
    if (payload.sourceId === activeMindMapId || payload.dnodeMindmapId === activeMindMapId) {
      console.warn("[StorySmith] Circular reference blocked: Cannot add a D-node to its own source mindmap.");
      return;
    }

    let dnodeNodeId, dnodeName, dnodeMindmapId;

    if (payload.type === 'dnode_existing') {
      // Register this existing D-node in the current mindmap
      dnodeNodeId    = payload.dnodeNodeId;
      dnodeName      = payload.dnodeName;
      dnodeMindmapId = payload.dnodeMindmapId;
      await registerDNodeInMindmap(dnodeNodeId, activeMindMapId);

    } else {
      // Create a brand new D-node from a mindmap or note name
      const name = payload.name;
      const sourceId = payload.sourceId; 
      const type = payload.type === 'dnode_new_from_mindmap' ? 'mindmap' : 'note';
      const result = await addDNode(name, activeMindMapId, sourceId, type);
      dnodeNodeId    = result.nodeRecord.node_id;
      dnodeName      = name;
      dnodeMindmapId = result.nodeRecord.mind_map_id;
    }

    // Add the D-node React Flow node to the canvas
    const rfNodeId = `dnode_${dnodeNodeId}_${Date.now()}`;
    const newNode = {
      id:       rfNodeId,
      type:     'dnode',
      position,
      data: {
        label:          dnodeName,
        dnodeNodeId,
        dnodeName,
        dnodeMindmapId,
        isDNode:        true,
      },
    };

    setNodes((prev) => [...prev, newNode]);
    setIsDirty(true);
  }, [activeMindMapId, addDNode, registerDNodeInMindmap]);

  // ───────────────────────────────────────────────────────────────────────────
  // PROPPED NODES & EDGES
  // Injects live callbacks into node data so nodes can communicate back.
  // ───────────────────────────────────────────────────────────────────────────

  const proppedNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,

        // ── D-node callbacks ──────────────────────────────────────────────
        ...(node.type === 'dnode' && {
          onEnterDNode: enterDNode,
          onDelete: async (id) => {
            // Unregister this instance from the D-node record
            const n = nodes.find((x) => x.id === id);
            if (n?.data?.dnodeNodeId) {
              await unregisterDNodeFromMindmap(n.data.dnodeNodeId, activeMindMapId);
            }
            setNodes((prev) => prev.filter((x) => x.id !== id));
            setIsDirty(true);
          },
          onChangeColor: (id, bgColor) => {
            setNodes((prev) => prev.map((n) =>
              n.id === id ? { ...n, data: { ...n.data, bgColor } } : n
            ));
            setIsDirty(true);
          },
        }),

        // ── Tracker node callback ─────────────────────────────────────────
        ...(node.type === 'dnode_tracker' && {
          onGoToHost: goToHostMindmap,
        }),

        // ── Regular node callbacks ────────────────────────────────────────
        ...(node.type !== 'dnode' && node.type !== 'dnode_tracker' && {
          onLabelChange,
          onDelete: (id) => {
            setNodes((prev) => {
              const target = prev.find((n) => n.id === id);
              if (target?.data?.isReference) return prev; // can't delete reference nodes
              return prev.filter((n) => n.id !== id);
            });
            setIsDirty(true);
          },
          onChangeColor: (id, bgColor) => {
            setNodes((prev) => prev.map((n) =>
              n.id === id ? { ...n, data: { ...n.data, bgColor } } : n
            ));
            setIsDirty(true);
          },
          onPromoteToDNode: async (id, label) => {
            if (!activeMindMapId) return;
            console.log("[StorySmith] Promoting node to D-node:", { id, label });

            try {
              // 1. Create the D-node via the store (handles DB + state)
              const result = await addDNode(label, activeMindMapId);
              const { nodeRecord } = result;
              console.log("[StorySmith] D-node created successfully:", nodeRecord);

              // 2. Transform the local node into a D-node instance
              let updatedNodes;
              setNodes((prev) => {
                updatedNodes = prev.map((n) => {
                  if (n.id !== id) return n;
                  return {
                    ...n,
                    type: 'dnode',
                    data: {
                      ...n.data,
                      label:          label,
                      dnodeNodeId:    nodeRecord.node_id,
                      dnodeName:      label,
                      dnodeMindmapId: nodeRecord.mind_map_id,
                      isDNode:        true,
                    }
                  };
                });
                return updatedNodes;
              });

              // 3. FORCE SAVE the current mindmap before leaving
              // This ensures the node's transformation is persisted
              setIsDirty(false); // clear dirty flag before manual save to prevent double-save
              await persistMindMap(activeMindMapId, { nodes: updatedNodes, edges });
              console.log("[StorySmith] Host mindmap saved with new D-node.");

              // 4. Immediately navigate into the new D-node workspace
              enterDNode(nodeRecord.node_id);
            } catch (err) {
              console.error("[StorySmith] Promotion failed:", err);
              alert("Failed to create portal. Check console for details.");
            }
          },
        }),
      },
    }));
  }, [nodes, activeMindMapId, enterDNode, onLabelChange,
      unregisterDNodeFromMindmap, goToHostMindmap, addDNode, persistMindMap]);

  const proppedEdges = useMemo(() => {
    return edges.map((edge) => {
      const propped = {
        ...edge,
        data: {
          ...edge.data,
          onEdgeLabelChange,
          onEdgeColorChange,
          onLineTypeChange,
          onEdgeDelete,
        },
      };
      if (edge.markerEnd)   propped.markerEnd   = edge.markerEnd;
      if (edge.markerStart) propped.markerStart = edge.markerStart;
      return propped;
    });
  }, [edges, onEdgeLabelChange, onEdgeColorChange, onLineTypeChange, onEdgeDelete]);

  // ── Paste image from clipboard ────────────────────────────────────────────
  useEffect(() => {
    const handlePaste = (event) => {
      const items = (event.clipboardData || event.originalEvent?.clipboardData)?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const id = `image_${Date.now()}`;
              
              // Calculate initial size based on natural dimensions, capping at 600px
              let width = img.naturalWidth;
              let height = img.naturalHeight;
              const maxDim = 600;
              
              if (width > maxDim || height > maxDim) {
                const ratio = width / height;
                if (width > height) {
                  width = maxDim;
                  height = maxDim / ratio;
                } else {
                  height = maxDim;
                  width = maxDim * ratio;
                }
              }

              setNodes((prev) => {
                const position = getSpawnPosition(prev);
                return [...prev, {
                  id, type: 'image',
                  position,
                  data: {
                    url: e.target.result,
                    label: '',
                  },
                  style: { width, height },
                }];
              });
              setIsDirty(true);
            };
            img.src = e.target.result;
          };
          reader.readAsDataURL(item.getAsFile());
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [getSpawnPosition]);

  // ── Warn before unload ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  return {
    nodes,
    edges,
    proppedNodes,
    proppedEdges,
    isDirty,
    rfInstance,       // pass to <ReactFlow onInit={rfInstance.current = inst} />
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    placeDNode,
    enterDNode,
    goBackToMindMap,
    goToHostMindmap,
    onEdgeLabelChange,
    onEdgeColorChange,
    onLineTypeChange,
    onEdgeDelete,
    onLabelChange,
    setIsDirty,
    setNodes,
    setEdges,
  };
}