/**
 * useStore.js — StorySmith Global State (Zustand)
 * ────────────────────────────────────────────────
 * The shape of this store is identical to before.
 * The only change is that all DB calls are now awaited —
 * PouchDB is async (Promise-based) whereas sql.js was synchronous.
 *
 * Everything else in the app (components, hooks) stays exactly the same
 * because they only ever talk to this store, never to db.js directly.
 */

import { create } from "zustand";
import {
  getAllCanvases,
  createCanvas,
  updateCanvasName,
  deleteCanvas,
  getNotesForCanvas,
  createNote,
  saveNote,
  deleteNote,
  getMindMapsForCanvas,
  createMindMap,
  saveMindMap,
  deleteMindMap,
} from "../features/Database/db";

const useStore = create((set, get) => ({
  // ─── Canvas State ──────────────────────────────────────────────────────────
  canvases: [],
  activeCanvasId: null,

  // ─── Content State ─────────────────────────────────────────────────────────
  notes: [],
  mindmaps: [],
  activeNoteId: null,
  activeMindMapId: null,

  // ─── Workspace View ────────────────────────────────────────────────────────
  activeView: "note", // "note" | "mindmap"

  // ─── Theme ─────────────────────────────────────────────────────────────────
  theme: "default",

  // ───────────────────────────────────────────────────────────────────────────
  // CANVAS ACTIONS
  // ───────────────────────────────────────────────────────────────────────────

  /** Load all canvases from PouchDB into Zustand state */
  loadCanvases: async () => {
    const canvases = await getAllCanvases();
    set({ canvases });
  },

  /** Create a canvas and immediately select it */
  addCanvas: async (name) => {
    const canvas = await createCanvas(name);
    set((state) => ({
      canvases: [canvas, ...state.canvases],
      activeCanvasId: canvas.id,
      notes: [],
      mindmaps: [],
      activeNoteId: null,
      activeMindMapId: null,
    }));
    return canvas;
  },

  /** Switch active canvas and load its notes + mindmaps */
  selectCanvas: async (id) => {
    const [notes, mindmaps] = await Promise.all([
      getNotesForCanvas(id),
      getMindMapsForCanvas(id),
    ]);
    set({
      activeCanvasId: id,
      notes,
      mindmaps,
      activeNoteId: notes[0]?.note_id || null,
      activeMindMapId: mindmaps[0]?.mindmap_id || null,
      activeView: notes.length > 0 ? "note" : mindmaps.length > 0 ? "mindmap" : "note",
    });
  },

  /** Rename a canvas */
  renameCanvas: async (id, name) => {
    await updateCanvasName(id, name);
    set((state) => ({
      canvases: state.canvases.map((c) => (c.id === id ? { ...c, name } : c)),
    }));
  },

  /** Delete a canvas and all its children */
  removeCanvas: async (id) => {
    await deleteCanvas(id);
    set((state) => {
      const canvases = state.canvases.filter((c) => c.id !== id);
      return {
        canvases,
        activeCanvasId: canvases[0]?.id || null,
        notes: [],
        mindmaps: [],
        activeNoteId: null,
        activeMindMapId: null,
      };
    });
    // If a new canvas is now active, load its content
    const newId = get().activeCanvasId;
    if (newId) get().selectCanvas(newId);
  },

  // ───────────────────────────────────────────────────────────────────────────
  // NOTE ACTIONS
  // ───────────────────────────────────────────────────────────────────────────

  /** Create a note in the active canvas */
  addNote: async (name) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    const note = await createNote(activeCanvasId, name);
    set((state) => ({
      notes: [note, ...state.notes],
      activeNoteId: note.note_id,
      activeView: "note",
    }));
    return note;
  },

  /** Switch the active note */
  selectNote: (noteId) => {
    set({ activeNoteId: noteId, activeView: "note" });
  },

  /**
   * Persist note content to PouchDB and update the in-memory notes array.
   * @param {string} noteId
   * @param {object} tiptapJson — editor.getJSON() result (a real JS object)
   * @param {string} [name]     — optional rename
   */
  persistNote: async (noteId, tiptapJson, name) => {
    await saveNote(noteId, tiptapJson, name);
    const ts = new Date().toISOString();
    set((state) => ({
      notes: state.notes.map((n) =>
        n.note_id === noteId
          ? {
              ...n,
              essence: tiptapJson,                    // object, not a string
              note_name: name ?? n.note_name,
              date_last_modified: ts,
            }
          : n
      ),
    }));
  },

  /** Delete a note */
  removeNote: async (noteId) => {
    await deleteNote(noteId);
    set((state) => {
      const notes = state.notes.filter((n) => n.note_id !== noteId);
      return { notes, activeNoteId: notes[0]?.note_id || null };
    });
  },

  // ───────────────────────────────────────────────────────────────────────────
  // MINDMAP ACTIONS
  // ───────────────────────────────────────────────────────────────────────────

  /** Create a mindmap in the active canvas */
  addMindMap: async (name) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    const mm = await createMindMap(activeCanvasId, name);
    set((state) => ({
      mindmaps: [mm, ...state.mindmaps],
      activeMindMapId: mm.mindmap_id,
      activeView: "mindmap",
    }));
    return mm;
  },

  /** Switch the active mindmap */
  selectMindMap: (mindmapId) => {
    set({ activeMindMapId: mindmapId, activeView: "mindmap" });
  },

  /**
   * Persist mindmap content to PouchDB and update in-memory state.
   * @param {string} mindmapId
   * @param {{ nodes: object[], edges: object[] }} rfJson — React Flow state
   * @param {string} [name]
   */
  persistMindMap: async (mindmapId, rfJson, name) => {
    await saveMindMap(mindmapId, rfJson, name);
    const ts = new Date().toISOString();
    set((state) => ({
      mindmaps: state.mindmaps.map((m) =>
        m.mindmap_id === mindmapId
          ? {
              ...m,
              essence: rfJson,                        // object, not a string
              mindmap_name: name ?? m.mindmap_name,
              date_last_modified: ts,
            }
          : m
      ),
    }));
  },

  /** Delete a mindmap */
  removeMindMap: async (mindmapId) => {
    await deleteMindMap(mindmapId);
    set((state) => {
      const mindmaps = state.mindmaps.filter((m) => m.mindmap_id !== mindmapId);
      return { mindmaps, activeMindMapId: mindmaps[0]?.mindmap_id || null };
    });
  },

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