/**
 * useStore.js — StorySmith Global State (Zustand)
 * ────────────────────────────────────────────────
 * D-NODE ADDITIONS:
 *   - dNodes          — all D-node records (global, not per-canvas)
 *   - dNodeMindMaps   — all D-node mindmaps (global, not per-canvas)
 *   - dnodePanelOpen  — whether the D-node picker panel is visible
 *
 *   Actions added:
 *     loadDNodes()
 *     createDNode(name, hostMindmapId)
 *     registerDNodeInMindmap(dnodeNodeId, hostMindmapId)
 *     unregisterDNodeFromMindmap(dnodeNodeId, hostMindmapId)
 *     renameDNode(dnodeNodeId, newName)
 *     removeDNodeMindmap(dnodeNodeId)
 *     openDNodePanel() / closeDNodePanel()
 *     selectDNodeMindMap(mindmapId)   — navigate into a D-node mindmap
 */

import { create } from "zustand";
import {
  // Canvas
  getAllCanvases, createCanvas, updateCanvasName, deleteCanvas,
  // Notes
  getNotesForCanvas, createNote, saveNote, deleteNote, getAllNotes,
  // MindMaps
  getMindMapsForCanvas, createMindMap, saveMindMap, deleteMindMap, getAllMindMaps,
  // D-Nodes
  getAllDNodes, getAllDNodeMindMaps,
  createDNode       as dbCreateDNode,
  promoteMindMapToDNode as dbPromoteMindMap,
  registerDNodeInMindmap  as dbRegisterDNode,
  unregisterDNodeFromMindmap as dbUnregisterDNode,
  renameDNode       as dbRenameDNode,
  deleteDNodeMindmap as dbDeleteDNodeMindmap,
  getMindMap,
} from "../features/Database/db";

const useStore = create((set, get) => ({

  // ─── Canvas ──────────────────────────────────────────────────────────────
  canvases:        [],
  activeCanvasId:  null,

  // ─── Content (per active canvas) ─────────────────────────────────────────
  notes:           [],
  mindmaps:        [],       // regular mindmaps only
  allNotes:        [],       // global list for D-node picker
  allMindmaps:     [],       // global list for D-node picker
  activeNoteId:    null,
  activeMindMapId: null,

  // ─── D-Nodes (global) ────────────────────────────────────────────────────
  dNodes:          [],       // all D-node records (nodes table)
  dNodeMindMaps:   [],       // all D-node mindmaps (is_dnode: true)
  dnodePanelOpen:  false,    // D-node picker panel visibility

  // ─── Navigation (Breadcrumbs) ─────────────────────────────────────────────
  navigationPath:  [],       // array of { id, name, type: "note" | "mindmap" }

  // ─── Workspace view ──────────────────────────────────────────────────────
  activeView:      "note",   // "note" | "mindmap"

  // ─── Theme ───────────────────────────────────────────────────────────────
  theme:           "default",

  // ───────────────────────────────────────────────────────────────────────────
  // NAVIGATION (BREADCRUMBS)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * _navigateTo — internal helper to handle the common logic of switching view
   * and updating the breadcrumb trail.
   * mode: "reset" | "append" | "truncate"
   */
  _navigateTo: (id, name, type, mode = "reset") => {
    set((s) => {
      let newPath;
      if (mode === "reset") {
        newPath = [{ id, name, type }];
      } else if (mode === "append") {
        newPath = [...s.navigationPath, { id, name, type }];
      } else if (mode === "truncate") {
        const idx = s.navigationPath.findIndex((p) => p.id === id);
        newPath = idx !== -1 ? s.navigationPath.slice(0, idx + 1) : s.navigationPath;
      } else {
        newPath = s.navigationPath;
      }

      const updates = {
        activeView: type === "note" ? "note" : "mindmap",
        navigationPath: newPath,
      };

      if (type === "note")    updates.activeNoteId = id;
      if (type === "mindmap") updates.activeMindMapId = id;

      return updates;
    });
  },

  jumpToPathIndex: (index) => {
    const { navigationPath } = get();
    const target = navigationPath[index];
    if (!target) return;
    get()._navigateTo(target.id, target.name, target.type, "truncate");
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CANVAS ACTIONS
  // ───────────────────────────────────────────────────────────────────────────

  loadCanvases: async () => {
    const canvases = await getAllCanvases();
    set({ canvases });
  },

  addCanvas: async (name) => {
    const canvas = await createCanvas(name);
    set((s) => ({
      canvases:        [canvas, ...s.canvases],
      activeCanvasId:  canvas.id,
      notes:           [],
      mindmaps:        [],
      activeNoteId:    null,
      activeMindMapId: null,
      navigationPath:  [],
    }));
    return canvas;
  },

  selectCanvas: async (id) => {
    const [notes, mindmaps] = await Promise.all([
      getNotesForCanvas(id),
      getMindMapsForCanvas(id),
    ]);

    set({
      activeCanvasId:  id,
      notes,
      mindmaps,
      navigationPath:  [], // cleared, will be set by selectNote/selectMindMap below
    });

    // Default to the first note or mindmap
    if (notes.length > 0) {
      get().selectNote(notes[0].note_id, "reset");
    } else if (mindmaps.length > 0) {
      get().selectMindMap(mindmaps[0].mindmap_id, "reset");
    }
  },

  renameCanvas: async (id, name) => {
    await updateCanvasName(id, name);
    set((s) => ({
      canvases: s.canvases.map((c) => c.id === id ? { ...c, name } : c),
    }));
  },

  removeCanvas: async (id) => {
    await deleteCanvas(id);
    set((s) => {
      const canvases = s.canvases.filter((c) => c.id !== id);
      return {
        canvases,
        activeCanvasId:  canvases[0]?.id || null,
        notes:           [],
        mindmaps:        [],
        activeNoteId:    null,
        activeMindMapId: null,
        navigationPath:  [],
      };
    });
    const newId = get().activeCanvasId;
    if (newId) get().selectCanvas(newId);
  },

  // ───────────────────────────────────────────────────────────────────────────
  // NOTE ACTIONS
  // ───────────────────────────────────────────────────────────────────────────

  addNote: async (name) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    const note = await createNote(activeCanvasId, name);
    set((s) => ({
      notes:        [note, ...s.notes],
      allNotes:     [note, ...s.allNotes],
      activeNoteId: note.note_id,
      activeView:   "note",
      navigationPath: [{ id: note.note_id, name: note.note_name, type: "note" }],
    }));
    return note;
  },

  selectNote: (noteId, mode = "reset") => {
    const s = get();
    const note = s.allNotes.find((n) => n.note_id === noteId) ||
                 s.notes.find((n) => n.note_id === noteId);
    get()._navigateTo(noteId, note?.note_name || "Note", "note", mode);
  },

  persistNote: async (noteId, tiptapJson, name) => {
    await saveNote(noteId, tiptapJson, name);
    const ts = new Date().toISOString();
    set((s) => {
      const updatedNotes = s.notes.map((n) =>
        n.note_id === noteId
          ? { ...n, essence: tiptapJson, note_name: name ?? n.note_name, date_last_modified: ts }
          : n
      );
      const updatedAllNotes = s.allNotes.map((n) =>
        n.note_id === noteId
          ? { ...n, essence: tiptapJson, note_name: name ?? n.note_name, date_last_modified: ts }
          : n
      );
      // Also update breadcrumb name if it matches
      const updatedPath = s.navigationPath.map((p) =>
        p.id === noteId ? { ...p, name: name ?? p.name } : p
      );
      
      return {
        notes: updatedNotes,
        allNotes: updatedAllNotes,
        navigationPath: updatedPath,
      };
    });
  },

  removeNote: async (noteId) => {
    await deleteNote(noteId);
    set((s) => {
      const notes = s.notes.filter((n) => n.note_id !== noteId);
      const allNotes = s.allNotes.filter((n) => n.note_id !== noteId);
      const navigationPath = s.navigationPath.filter((p) => p.id !== noteId);
      return { 
        notes, 
        allNotes, 
        navigationPath,
        activeNoteId: notes[0]?.note_id || null 
      };
    });
  },

  // ───────────────────────────────────────────────────────────────────────────
  // MINDMAP ACTIONS (regular)
  // ───────────────────────────────────────────────────────────────────────────

  addMindMap: async (name) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    const mm = await createMindMap(activeCanvasId, name);
    set((s) => ({
      mindmaps:        [mm, ...s.mindmaps],
      allMindmaps:     [mm, ...s.allMindmaps],
      activeMindMapId: mm.mindmap_id,
      activeView:      "mindmap",
      navigationPath:  [{ id: mm.mindmap_id, name: mm.mindmap_name, type: "mindmap" }],
    }));
    return mm;
  },

  selectMindMap: (mindmapId, mode = "reset") => {
    const s = get();
    const mm = s.allMindmaps.find((m) => m.mindmap_id === mindmapId) ||
               s.mindmaps.find((m) => m.mindmap_id === mindmapId);
    get()._navigateTo(mindmapId, mm?.mindmap_name || "MindMap", "mindmap", mode);
  },

  persistMindMap: async (mindmapId, rfJson, name) => {
    await saveMindMap(mindmapId, rfJson, name);
    const ts = new Date().toISOString();
    set((s) => {
      const updatedMM = s.mindmaps.map((m) =>
        m.mindmap_id === mindmapId
          ? { ...m, essence: rfJson, mindmap_name: name ?? m.mindmap_name, date_last_modified: ts }
          : m
      );
      const updatedAllMM = s.allMindmaps.map((m) =>
        m.mindmap_id === mindmapId
          ? { ...m, essence: rfJson, mindmap_name: name ?? m.mindmap_name, date_last_modified: ts }
          : m
      );
      const updatedDNodeMM = s.dNodeMindMaps.map((m) =>
        m.mindmap_id === mindmapId
          ? { ...m, essence: rfJson, mindmap_name: name ?? m.mindmap_name, date_last_modified: ts }
          : m
      );
      // Also update breadcrumb name if it matches
      const updatedPath = s.navigationPath.map((p) =>
        p.id === mindmapId ? { ...p, name: name ?? p.name } : p
      );

      return {
        mindmaps: updatedMM,
        allMindmaps: updatedAllMM,
        dNodeMindMaps: updatedDNodeMM,
        navigationPath: updatedPath,
      };
    });
  },

  removeMindMap: async (mindmapId) => {
    await deleteMindMap(mindmapId);
    set((s) => {
      const mindmaps = s.mindmaps.filter((m) => m.mindmap_id !== mindmapId);
      const allMindmaps = s.allMindmaps.filter((m) => m.mindmap_id !== mindmapId);
      const navigationPath = s.navigationPath.filter((p) => p.id !== mindmapId);
      return { 
        mindmaps, 
        allMindmaps, 
        navigationPath,
        activeMindMapId: mindmaps[0]?.mindmap_id || null 
      };
    });
  },

  // ───────────────────────────────────────────────────────────────────────────
  // D-NODE ACTIONS
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * loadDNodes — fetch all D-node records and D-node mindmaps from PouchDB.
   * Call once on app start alongside loadCanvases.
   */
  loadDNodes: async () => {
    const [dNodes, dNodeMindMaps, allNotes, allMindmaps] = await Promise.all([
      getAllDNodes(),
      getAllDNodeMindMaps(),
      getAllNotes(),
      getAllMindMaps(),
    ]);
    set({ dNodes, dNodeMindMaps, allNotes, allMindmaps });
  },

  /**
   * addDNode — creates a new D-node (or registers an existing one in a mindmap).
   *
   * @param {string} name          — the D-node's global name
   * @param {string} hostMindmapId — the mindmap it's being placed into
   * @param {string} sourceId      — (optional) the ID of the MindMap or Note it was created from
   * @param {string} type          — (optional) "mindmap" | "note"
   * @returns {{ nodeRecord, mindmap }} — the created/updated records
   */
  addDNode: async (name, hostMindmapId, sourceId, type) => {
    let result;
    if (type === "mindmap" && sourceId) {
      // Promotion flow: convert existing mindmap to D-node
      result = await dbPromoteMindMap(sourceId, hostMindmapId);
    } else {
      // Standard flow: create a new D-node mindmap
      result = await dbCreateDNode(name, hostMindmapId, sourceId, type);
    }

    const { nodeRecord, mindmap } = result;

    set((s) => {
      // If this D-node already existed, update existing records
      const existingNode = s.dNodes.find((d) => d.node_id === nodeRecord.node_id);
      const existingMM   = mindmap 
        ? s.dNodeMindMaps.find((m) => m.mindmap_id === mindmap.mindmap_id)
        : null;

      // If we promoted a mindmap, remove it from the regular mindmaps list
      const mindmaps = (type === "mindmap" && sourceId)
        ? s.mindmaps.filter(m => m.mindmap_id !== sourceId)
        : s.mindmaps;

      const updatedDNodeMindMaps = mindmap 
        ? (existingMM
            ? s.dNodeMindMaps.map((m) => m.mindmap_id === mindmap.mindmap_id ? mindmap : m)
            : [...s.dNodeMindMaps, mindmap])
        : s.dNodeMindMaps;

      return {
        mindmaps,
        dNodes: existingNode
          ? s.dNodes.map((d) => d.node_id === nodeRecord.node_id ? nodeRecord : d)
          : [...s.dNodes, nodeRecord],
        dNodeMindMaps: updatedDNodeMindMaps,
      };
    });

    return result;
  },

  /**
   * registerDNodeInMindmap — call when an existing D-node is placed into
   * a new mindmap (e.g. dragged from the D-node panel).
   */
  registerDNodeInMindmap: async (dnodeNodeId, hostMindmapId) => {
    const result = await dbRegisterDNode(dnodeNodeId, hostMindmapId);
    // Refresh the D-node record in store
    set((s) => ({
      dNodes: s.dNodes.map((d) =>
        d.node_id === dnodeNodeId ? result.nodeRecord : d
      ),
    }));
    return result;
  },

  /**
   * unregisterDNodeFromMindmap — call when a D-node instance is deleted
   * from a mindmap.
   */
  unregisterDNodeFromMindmap: async (dnodeNodeId, hostMindmapId) => {
    await dbUnregisterDNode(dnodeNodeId, hostMindmapId);
    // Refresh the updated node record
    const [dNodes, dNodeMindMaps] = await Promise.all([
      getAllDNodes(),
      getAllDNodeMindMaps(),
    ]);
    set({ dNodes, dNodeMindMaps });
  },

  /**
   * renameDNode — renames a D-node globally.
   * Updates node record, mindmap name, and identity node label.
   */
  renameDNode: async (dnodeNodeId, newName) => {
    await dbRenameDNode(dnodeNodeId, newName);
    // Reload to get fresh state
    const [dNodes, dNodeMindMaps] = await Promise.all([
      getAllDNodes(),
      getAllDNodeMindMaps(),
    ]);
    set({ dNodes, dNodeMindMaps });
  },

  /**
   * removeDNodeMindmap — deletes a D-node and its mindmap.
   * Converts all instances in host mindmaps back to regular ellipse nodes.
   */
  removeDNodeMindmap: async (dnodeNodeId) => {
    await dbDeleteDNodeMindmap(dnodeNodeId);
    set((s) => ({
      dNodes:       s.dNodes.filter((d) => d.node_id !== dnodeNodeId),
      dNodeMindMaps: s.dNodeMindMaps.filter(
        (m) => !s.dNodes.find(
          (d) => d.node_id === dnodeNodeId && d.mind_map_id === m.mindmap_id
        )
      ),
      // If the deleted D-node mindmap was active, clear it
      activeMindMapId: s.activeMindMapId === s.dNodes.find(
        (d) => d.node_id === dnodeNodeId
      )?.mind_map_id
        ? null
        : s.activeMindMapId,
    }));
  },

  /**
   * selectDNodeMindMap — navigate into a D-node's mindmap.
   * Sets it as the active mindmap and switches to mindmap view.
   * The D-node mindmap is loaded from the dNodeMindMaps array
   * (not the regular mindmaps array) since it's canvas-independent.
   */
  selectDNodeMindMap: (mindmapId, mode = "append") => {
    const s = get();
    const mm = s.dNodeMindMaps.find((m) => m.mindmap_id === mindmapId);
    get()._navigateTo(mindmapId, mm?.mindmap_name || "D-Node", "mindmap", mode);
  },

  // ── D-node panel ──────────────────────────────────────────────────────────
  openDNodePanel:  () => set({ dnodePanelOpen: true }),
  closeDNodePanel: () => set({ dnodePanelOpen: false }),

  // ───────────────────────────────────────────────────────────────────────────
  // UI ACTIONS
  // ───────────────────────────────────────────────────────────────────────────

  setActiveView: (view) => set({ activeView: view }),

  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
}));

export default useStore;