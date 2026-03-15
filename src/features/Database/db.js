/**
 * db.js — StorySmith Database Layer (PouchDB)
 * ─────────────────────────────────────────────
 * WHY POUCHDB:
 *   PouchDB is a fully embedded, document-oriented database that runs directly
 *   inside your app — no server process, no daemon, no native dependencies.
 *   It stores data locally using IndexedDB in the WebView (which Tauri provides).
 *   When you're ready to add cloud sync or move to a hosted backend, you point
 *   it at a CouchDB-compatible server and call db.sync() — one line of code.
 *
 * HOW DOCUMENTS ARE STRUCTURED:
 *   PouchDB stores JSON documents. Every document needs two special fields:
 *     _id  — the unique identifier (we set this ourselves, e.g. "canvas::uuid")
 *     _rev — a revision string PouchDB manages automatically for conflict tracking
 *
 *   We prefix every _id with the document type so we can fetch all documents of
 *   a given type efficiently using PouchDB's allDocs() range query:
 *     "canvas::<uuid>"   → a Canvas document
 *     "note::<uuid>"     → a Note document
 *     "mindmap::<uuid>"  → a MindMap document
 *     "node::<uuid>"     → a Node document
 *
 * IMPORTANT — ALL FUNCTIONS ARE ASYNC:
 *   Unlike the previous sql.js version (which was synchronous), every PouchDB
 *   operation returns a Promise. The Zustand store actions that call these
 *   functions must use await. The store has been updated accordingly.
 *
 * EXPORTED API (same shape as before so the rest of the app doesn't change):
 *   initDB()
 *   createCanvas(name)          → canvas doc
 *   getAllCanvases()             → canvas doc[]
 *   getCanvas(id)               → canvas doc | null
 *   updateCanvasName(id, name)
 *   deleteCanvas(id)            — also deletes all child notes, mindmaps, nodes
 *   createNote(canvasId, name)  → note doc
 *   getNotesForCanvas(canvasId) → note doc[]
 *   getNote(noteId)             → note doc | null
 *   saveNote(noteId, tiptapJson, name?)
 *   deleteNote(noteId)
 *   createMindMap(canvasId, name) → mindmap doc
 *   getMindMapsForCanvas(canvasId) → mindmap doc[]
 *   getMindMap(mindmapId)          → mindmap doc | null
 *   saveMindMap(mindmapId, rfJson, name?)
 *   deleteMindMap(mindmapId)
 *   createNode(canvasId, name, mindMapId?) → node doc
 *   getNodesForCanvas(canvasId)            → node doc[]
 *   addMindMapToNode(nodeId, mindmapId)
 *   deleteNode(nodeId)
 *   syncWithRemote(remoteUrl)  ← NEW: one-line cloud sync when you're ready
 */

import PouchDB from "pouchdb";
//browser optimised
// import PouchDB from "pouchdb-browser";

// ─── Database instance ────────────────────────────────────────────────────────
// PouchDB creates (or reopens) a local database named "storysmith".
// In Tauri's WebView this is backed by IndexedDB, which persists to disk
// inside the app's data directory — no extra configuration needed.
let db = null;

// ─── ID prefix constants ──────────────────────────────────────────────────────
// Prefixing IDs lets us do efficient range queries: allDocs({ startkey, endkey })
const PREFIX = {
  CANVAS:  "canvas::",
  NOTE:    "note::",
  MINDMAP: "mindmap::",
  NODE:    "node::",
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIALISATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * initDB — open (or create) the local PouchDB database.
 * Call this once in App.jsx before rendering anything.
 * PouchDB is schemaless — no table creation needed.
 */
export async function initDB() {
  // "storysmith" is the database name. PouchDB stores it in IndexedDB
  // under that name automatically. If it already exists, it's just reopened.
  db = new PouchDB("storysmith");
  console.log("[StorySmith DB] PouchDB ready ✓", await db.info());
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOUD SYNC  (call this whenever you're ready — works with CouchDB / Cloudant)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * syncWithRemote — start a live two-way sync with a remote CouchDB server.
 * This is the migration path from local → cloud. Call it once after initDB().
 *
 * @param {string} remoteUrl  e.g. "https://username:password@myserver.com/storysmith"
 *
 * Example:
 *   import { syncWithRemote } from './db'
 *   syncWithRemote('https://admin:pass@localhost:5984/storysmith')
 */
export function syncWithRemote(remoteUrl) {
  if (!db) throw new Error("DB not initialised — call initDB() first");

  // live: true  → keeps syncing in real time (not just a one-shot push/pull)
  // retry: true → automatically reconnects if the network drops
  const sync = db.sync(remoteUrl, { live: true, retry: true });

  sync
    .on("change",   (info)  => console.log("[Sync] change",   info))
    .on("paused",   (err)   => console.log("[Sync] paused",   err))
    .on("active",   ()      => console.log("[Sync] active"))
    .on("denied",   (err)   => console.error("[Sync] denied", err))
    .on("error",    (err)   => console.error("[Sync] error",  err));

  return sync; // caller can call sync.cancel() to stop
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/** Current ISO 8601 timestamp */
const now = () => new Date().toISOString();

/** Collision-safe UUID */
const uuid = () => crypto.randomUUID();

/**
 * fetchByPrefix — fetch all documents whose _id starts with a given prefix.
 * PouchDB's allDocs supports key ranges; "\ufff0" is a high Unicode char that
 * sorts after all normal characters, so startkey="note::" endkey="note::\ufff0"
 * returns every note document.
 *
 * @param {string} prefix  e.g. "note::"
 * @returns {Promise<object[]>} array of document bodies (without _id/_rev noise)
 */
async function fetchByPrefix(prefix) {
  const result = await db.allDocs({
    startkey: prefix,
    endkey:   prefix + "\ufff0",  // "\ufff0" sorts after all normal characters
    include_docs: true,           // include the full document body, not just IDs
  });
  // result.rows is [{ id, key, value: { rev }, doc: { ...fields } }]
  // We only want the doc bodies.
  return result.rows.map((row) => row.doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Document shape:
 * {
 *   _id:               "canvas::<uuid>",
 *   _rev:              "<managed by PouchDB>",
 *   type:              "canvas",
 *   id:                "<uuid>",          ← convenience copy without prefix
 *   name:              string,
 *   date_last_modified: ISO string,
 *   date_created:       ISO string,
 * }
 */

/** Create a new canvas and return it */
export async function createCanvas(name = "Untitled Canvas") {
  const id = uuid();
  const ts = now();
  const doc = {
    _id:                PREFIX.CANVAS + id,
    type:               "canvas",
    id,                           // kept as a clean field for convenience
    name,
    date_last_modified: ts,
    date_created:       ts,
  };
  await db.put(doc);
  return doc;
}

/** Fetch all canvases, sorted newest-modified first */
export async function getAllCanvases() {
  const docs = await fetchByPrefix(PREFIX.CANVAS);
  return docs.sort((a, b) =>
    new Date(b.date_last_modified) - new Date(a.date_last_modified)
  );
}

/** Fetch a single canvas by its short id (without prefix) */
export async function getCanvas(id) {
  try {
    return await db.get(PREFIX.CANVAS + id);
  } catch {
    return null; // PouchDB throws a 404 error if not found
  }
}

/** Rename a canvas (must fetch first to get the current _rev for the update) */
export async function updateCanvasName(id, name) {
  const doc = await db.get(PREFIX.CANVAS + id);
  // Spread existing fields, overwrite name and timestamp.
  // _rev MUST be included — PouchDB rejects updates without it.
  await db.put({ ...doc, name, date_last_modified: now() });
}

/**
 * Delete a canvas AND all its child notes, mindmaps, and nodes.
 * PouchDB has no cascade deletes, so we do it manually.
 */
export async function deleteCanvas(id) {
  // Fetch all children first
  const [notes, mindmaps, nodes] = await Promise.all([
    getNotesForCanvas(id),
    getMindMapsForCanvas(id),
    getNodesForCanvas(id),
  ]);

  // Build a bulk delete list: PouchDB bulk deletes by setting _deleted: true
  const deletions = [...notes, ...mindmaps, ...nodes].map((doc) => ({
    _id:      doc._id,
    _rev:     doc._rev,
    _deleted: true,
  }));

  // Delete all children in one batch, then delete the canvas itself
  if (deletions.length) await db.bulkDocs(deletions);

  const canvas = await db.get(PREFIX.CANVAS + id);
  await db.remove(canvas);
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTE CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Document shape:
 * {
 *   _id:               "note::<uuid>",
 *   type:              "note",
 *   note_id:           "<uuid>",
 *   note_name:         string,
 *   canvas_id:         string,   ← short canvas id (without prefix)
 *   date_last_modified: ISO string,
 *   date_created:       ISO string,
 *   essence:           object,   ← Tiptap JSON (stored as a real object, not a string)
 * }
 */

/** Create an empty note inside a canvas */
export async function createNote(canvasId, name = "Untitled Note") {
  const note_id = uuid();
  const ts = now();
  const doc = {
    _id:                PREFIX.NOTE + note_id,
    type:               "note",
    note_id,
    note_name:          name,
    canvas_id:          canvasId,
    date_last_modified: ts,
    date_created:       ts,
    essence:            { type: "doc", content: [] }, // empty Tiptap document
  };
  await db.put(doc);

  // Bump the parent canvas' last-modified timestamp
  await _touchCanvas(canvasId);
  return doc;
}

/** Fetch all notes belonging to a canvas, sorted newest-modified first */
export async function getNotesForCanvas(canvasId) {
  const docs = await fetchByPrefix(PREFIX.NOTE);
  return docs
    .filter((d) => d.canvas_id === canvasId)
    .sort((a, b) => new Date(b.date_last_modified) - new Date(a.date_last_modified));
}

/** Fetch a single note by its short id */
export async function getNote(noteId) {
  try {
    return await db.get(PREFIX.NOTE + noteId);
  } catch {
    return null;
  }
}

/**
 * Save updated content (and optionally a new name) to a note.
 * @param {string} noteId
 * @param {object} tiptapJson  — result of editor.getJSON()
 * @param {string} [name]      — pass to rename at the same time
 */
export async function saveNote(noteId, tiptapJson, name) {
  const doc = await db.get(PREFIX.NOTE + noteId);
  const updated = {
    ...doc,
    essence:            tiptapJson,   // stored as a real JS object — no JSON.stringify needed
    date_last_modified: now(),
  };
  if (name !== undefined) updated.note_name = name;
  await db.put(updated);
}

/** Delete a note */
export async function deleteNote(noteId) {
  const doc = await db.get(PREFIX.NOTE + noteId);
  await db.remove(doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// MINDMAP CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Document shape:
 * {
 *   _id:               "mindmap::<uuid>",
 *   type:              "mindmap",
 *   mindmap_id:        "<uuid>",
 *   mindmap_name:      string,
 *   canvas_id:         string,
 *   node_id:           string | null,  ← graph node that *represents* this mindmap
 *   date_last_modified: ISO string,
 *   date_created:       ISO string,
 *   essence:           { nodes: [], edges: [] },  ← React Flow state as a real object
 * }
 */

/** Create an empty mindmap inside a canvas */
export async function createMindMap(canvasId, name = "Untitled MindMap") {
  const mindmap_id = uuid();
  const ts = now();
  const doc = {
    _id:                PREFIX.MINDMAP + mindmap_id,
    type:               "mindmap",
    mindmap_id,
    mindmap_name:       name,
    canvas_id:          canvasId,
    node_id:            null,
    date_last_modified: ts,
    date_created:       ts,
    essence:            { nodes: [], edges: [] }, // empty React Flow graph
  };
  await db.put(doc);
  await _touchCanvas(canvasId);
  return doc;
}

/** Fetch all mindmaps for a canvas, sorted newest-modified first */
export async function getMindMapsForCanvas(canvasId) {
  const docs = await fetchByPrefix(PREFIX.MINDMAP);
  return docs
    .filter((d) => d.canvas_id === canvasId)
    .sort((a, b) => new Date(b.date_last_modified) - new Date(a.date_last_modified));
}

/** Fetch a single mindmap by its short id */
export async function getMindMap(mindmapId) {
  try {
    return await db.get(PREFIX.MINDMAP + mindmapId);
  } catch {
    return null;
  }
}

/**
 * Save updated React Flow state (and optionally a new name) to a mindmap.
 * @param {string} mindmapId
 * @param {{ nodes: object[], edges: object[] }} rfJson — React Flow's getNodes()/getEdges()
 * @param {string} [name]
 */
export async function saveMindMap(mindmapId, rfJson, name) {
  const doc = await db.get(PREFIX.MINDMAP + mindmapId);
  const updated = {
    ...doc,
    essence:            rfJson,   // real object — PouchDB serialises it automatically
    date_last_modified: now(),
  };
  if (name !== undefined) updated.mindmap_name = name;
  await db.put(updated);
}

/** Delete a mindmap */
export async function deleteMindMap(mindmapId) {
  const doc = await db.get(PREFIX.MINDMAP + mindmapId);
  await db.remove(doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Document shape:
 * {
 *   _id:               "node::<uuid>",
 *   type:              "node",
 *   node_id:           "<uuid>",
 *   name:              string,
 *   canvas_id:         string,
 *   list_of_mindmap_id: string[],  ← real array, not a JSON string
 *   mind_map_id:       string | null,  ← mindmap this node *represents*
 * }
 */

/** Create a graph node */
export async function createNode(canvasId, name = "Node", mindMapId = null) {
  const node_id = uuid();
  const doc = {
    _id:               PREFIX.NODE + node_id,
    type:              "node",
    node_id,
    name,
    canvas_id:         canvasId,
    list_of_mindmap_id: [],        // real array — no JSON.stringify needed
    mind_map_id:       mindMapId,
  };
  await db.put(doc);
  return doc;
}

/** Fetch all nodes for a canvas */
export async function getNodesForCanvas(canvasId) {
  const docs = await fetchByPrefix(PREFIX.NODE);
  return docs.filter((d) => d.canvas_id === canvasId);
}

/** Add a mindmap ID to a node's list_of_mindmap_id (if not already present) */
export async function addMindMapToNode(nodeId, mindmapId) {
  const doc = await db.get(PREFIX.NODE + nodeId);
  if (doc.list_of_mindmap_id.includes(mindmapId)) return; // already there
  await db.put({
    ...doc,
    list_of_mindmap_id: [...doc.list_of_mindmap_id, mindmapId],
  });
}

/** Delete a node */
export async function deleteNode(nodeId) {
  const doc = await db.get(PREFIX.NODE + nodeId);
  await db.remove(doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _touchCanvas — update a canvas's date_last_modified without changing anything else.
 * Called internally after creating a note or mindmap inside a canvas.
 */
async function _touchCanvas(canvasId) {
  try {
    const doc = await db.get(PREFIX.CANVAS + canvasId);
    await db.put({ ...doc, date_last_modified: now() });
  } catch {
    // Canvas might have been deleted — silently ignore
  }
}