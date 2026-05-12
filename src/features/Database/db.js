/**
 * db.js — StorySmith Database Layer (PouchDB)
 * ─────────────────────────────────────────────
 * Document prefixes:
 *   "canvas::<uuid>"   → Canvas
 *   "note::<uuid>"     → Note
 *   "mindmap::<uuid>"  → MindMap (regular OR D-node mindmap)
 *   "node::<uuid>"     → D-node record
 *
 * D-NODE DESIGN:
 *   A D-node is a globally unique, name-keyed entity. Its name IS its identity —
 *   there can never be two D-node records with the same name.
 *
 *   D-node mindmaps are regular mindmap documents with two extra fields:
 *     is_dnode: true          — marks it as a D-node mindmap
 *     canvas_id: null         — D-node mindmaps are not owned by any canvas
 *
 *   The nodes table record tracks:
 *     name                    — the global identity key (must be unique)
 *     mind_map_id             — the D-node mindmap this record represents
 *     list_of_mindmap_id      — every regular mindmap this D-node appears in
 *
 *   When a D-node mindmap is deleted:
 *     - The node record is deleted
 *     - All mindmaps that contained the D-node have their essence updated
 *       to convert D-node instances back to regular ellipse nodes
 */

import PouchDB from "pouchdb";

const db = new PouchDB("storysmith");

const PREFIX = {
  CANVAS:  "canvas::",
  NOTE:    "note::",
  MINDMAP: "mindmap::",
  NODE:    "node::",
};

// ─────────────────────────────────────────────────────────────────────────────
// INIT & SYNC
// ─────────────────────────────────────────────────────────────────────────────

export async function initDB() {
  console.log("[StorySmith DB] PouchDB ready ✓", await db.info());
}

export function syncWithRemote(remoteUrl) {
  if (!db) throw new Error("DB not initialised — call initDB() first");
  const sync = db.sync(remoteUrl, { live: true, retry: true });
  sync
    .on("change",  (info) => console.log("[Sync] change",  info))
    .on("paused",  (err)  => console.log("[Sync] paused",  err))
    .on("active",  ()     => console.log("[Sync] active"))
    .on("denied",  (err)  => console.error("[Sync] denied", err))
    .on("error",   (err)  => console.error("[Sync] error",  err));
  return sync;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────

const now  = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

async function fetchByPrefix(prefix) {
  const result = await db.allDocs({
    startkey:     prefix,
    endkey:       prefix + "\ufff0",
    include_docs: true,
  });
  return result.rows.map((row) => row.doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function createCanvas(name = "Untitled Canvas") {
  const id = uuid();
  const ts = now();
  const doc = {
    _id:                PREFIX.CANVAS + id,
    type:               "canvas",
    id,
    name,
    date_last_modified: ts,
    date_created:       ts,
  };
  await db.put(doc);
  return doc;
}

export async function getAllCanvases() {
  const docs = await fetchByPrefix(PREFIX.CANVAS);
  return docs.sort((a, b) =>
    new Date(b.date_last_modified) - new Date(a.date_last_modified)
  );
}

export async function getCanvas(id) {
  try { return await db.get(PREFIX.CANVAS + id); }
  catch { return null; }
}

export async function updateCanvasName(id, name) {
  const doc = await db.get(PREFIX.CANVAS + id);
  await db.put({ ...doc, name, date_last_modified: now() });
}

/**
 * deleteCanvas — deletes a canvas and all its owned content.
 * D-node mindmaps are NOT deleted here because they are canvas-independent.
 * However any D-node records that listed this canvas' mindmaps are cleaned up.
 */
export async function deleteCanvas(id) {
  const [notes, mindmaps, nodes] = await Promise.all([
    getNotesForCanvas(id),
    getMindMapsForCanvas(id),
    getNodesForCanvas(id),
  ]);

  // Regular children — bulk delete
  const deletions = [...notes, ...mindmaps, ...nodes].map((doc) => ({
    _id: doc._id, _rev: doc._rev, _deleted: true,
  }));
  if (deletions.length) await db.bulkDocs(deletions);

  const canvas = await db.get(PREFIX.CANVAS + id);
  await db.remove(canvas);
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTE CRUD
// ─────────────────────────────────────────────────────────────────────────────

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
    essence:            { type: "doc", content: [] },
  };
  await db.put(doc);
  await _touchCanvas(canvasId);
  return doc;
}

export async function getNotesForCanvas(canvasId) {
  const docs = await fetchByPrefix(PREFIX.NOTE);
  return docs
    .filter((d) => d.canvas_id === canvasId)
    .sort((a, b) => new Date(b.date_last_modified) - new Date(a.date_last_modified));
}

/**
 * getAllNotes — returns all notes across all canvases.
 */
export async function getAllNotes() {
  const docs = await fetchByPrefix(PREFIX.NOTE);
  return docs.sort((a, b) => new Date(b.date_last_modified) - new Date(a.date_last_modified));
}

export async function getNote(noteId) {
  try { return await db.get(PREFIX.NOTE + noteId); }
  catch { return null; }
}

export async function saveNote(noteId, tiptapJson, name) {
  const doc = await db.get(PREFIX.NOTE + noteId);
  const updated = { ...doc, essence: tiptapJson, date_last_modified: now() };
  if (name !== undefined) updated.note_name = name;
  await db.put(updated);
}

export async function deleteNote(noteId) {
  const doc = await db.get(PREFIX.NOTE + noteId);
  await db.remove(doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// MINDMAP CRUD  (regular mindmaps)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * createMindMap — creates a regular (non-D-node) mindmap inside a canvas.
 */
export async function createMindMap(canvasId, name = "Untitled MindMap") {
  const mindmap_id = uuid();
  const ts = now();
  const doc = {
    _id:                PREFIX.MINDMAP + mindmap_id,
    type:               "mindmap",
    mindmap_id,
    mindmap_name:       name,
    canvas_id:          canvasId,   // owned by this canvas
    is_dnode:           false,      // not a D-node mindmap
    node_id:            null,
    date_last_modified: ts,
    date_created:       ts,
    essence:            { nodes: [], edges: [] },
  };
  await db.put(doc);
  await _touchCanvas(canvasId);
  return doc;
}

/**
 * getMindMapsForCanvas — returns only regular (non-D-node) mindmaps for a canvas.
 */
export async function getMindMapsForCanvas(canvasId) {
  const docs = await fetchByPrefix(PREFIX.MINDMAP);
  return docs
    .filter((d) => d.canvas_id === canvasId && !d.is_dnode)
    .sort((a, b) => new Date(b.date_last_modified) - new Date(a.date_last_modified));
}

/**
 * getAllMindMaps — returns all regular (non-D-node) mindmaps across all canvases.
 */
export async function getAllMindMaps() {
  const docs = await fetchByPrefix(PREFIX.MINDMAP);
  return docs
    .filter((d) => !d.is_dnode)
    .sort((a, b) => new Date(b.date_last_modified) - new Date(a.date_last_modified));
}

export async function getMindMap(mindmapId) {
  try { return await db.get(PREFIX.MINDMAP + mindmapId); }
  catch { return null; }
}

export async function saveMindMap(mindmapId, rfJson, name) {
  const doc = await db.get(PREFIX.MINDMAP + mindmapId);
  const updated = { ...doc, essence: rfJson, date_last_modified: now() };
  if (name !== undefined) updated.mindmap_name = name;
  await db.put(updated);
}

export async function deleteMindMap(mindmapId) {
  const doc = await db.get(PREFIX.MINDMAP + mindmapId);
  await db.remove(doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// D-NODE CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getDNodeByName — look up an existing D-node record by name (the global key).
 * Returns the node doc or null if no D-node with that name exists.
 *
 * This is the duplicate-prevention check. Always call this before creating
 * a new D-node to avoid two D-nodes pointing at different mindmaps.
 */
export async function getDNodeByName(name) {
  const docs = await fetchByPrefix(PREFIX.NODE);
  return docs.find((d) => d.name === name) || null;
}

/**
 * getAllDNodes — returns all D-node records (the nodes table, not the mindmaps).
 * Used to populate the D-node picker panel.
 */
export async function getAllDNodes() {
  const docs = await fetchByPrefix(PREFIX.NODE);
  return docs.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * getAllDNodeMindMaps — returns all D-node mindmap documents (is_dnode: true).
 * These are listed separately from regular mindmaps in the sidebar.
 */
export async function getAllDNodeMindMaps() {
  const docs = await fetchByPrefix(PREFIX.MINDMAP);
  return docs
    .filter((d) => d.is_dnode)
    .sort((a, b) => a.mindmap_name.localeCompare(b.mindmap_name));
}

/**
 * createDNode — creates a new globally unique D-node.
 *
 * Steps:
 *   1. Check no D-node with this name already exists (throws if duplicate).
 *   2. Create the D-node mindmap (is_dnode: true, canvas_id: null).
 *   3. Populate the mindmap with two starter nodes:
 *        a. A fixed ellipse labelled with the D-node's name (the "identity" node)
 *        b. An appearances tracker node (type: "dnode_tracker")
 *   4. Create the node record linking name ↔ mindmap.
 *   5. Return { nodeRecord, mindmap }.
 *
 * @param {string} name       — the D-node's global name
 * @param {string} hostMindmapId — the mindmap the D-node is first placed in
 * @param {string} sourceId   — (optional) the ID of the MindMap or Note it was created from
 * @param {string} sourceType — (optional) "note" | "mindmap"
 */
export async function createDNode(name, hostMindmapId, sourceId, sourceType) {
  if (!name || typeof name !== "string") {
    throw new Error("D-node name is required and must be a string.");
  }

  // ── 1. Duplicate check ──────────────────────────────────────────────────
  const existing = await getDNodeByName(name);
  if (existing) {
    // D-node already exists — just register this new host mindmap and return
    return await _addHostMindmapToDNode(existing.node_id, hostMindmapId);
  }

  // ── 2. Determine source canvas ownership and type ────────────────────────
  let sourceCanvasId = null;
  let isNote = sourceType === "note";

  if (sourceId) {
    // If type not provided, infer it
    if (!sourceType) {
      const note = await getNote(sourceId);
      if (note) {
        sourceCanvasId = note.canvas_id;
        isNote = true;
      } else {
        const mm = await getMindMap(sourceId);
        if (mm) sourceCanvasId = mm.canvas_id;
      }
    } else {
      // Type provided — just fetch canvas_id
      const src = isNote ? await getNote(sourceId) : await getMindMap(sourceId);
      if (src) sourceCanvasId = src.canvas_id;
    }
  } else if (hostMindmapId) {
    // No source object — infer canvas from the map where it's being placed
    const host = await getMindMap(hostMindmapId);
    if (host) sourceCanvasId = host.canvas_id;
  }

  const node_id = uuid();
  const ts = now();

  let mindmap_id = null;
  let mindmapDoc = null;

  // ── 3. Create the D-node mindmap ONLY if it's NOT a note ─────────────────
  if (!isNote) {
    mindmap_id = uuid();

    // a. Fixed identity ellipse
    const identityNode = {
      id:       `dnode-identity-${node_id}`,
      type:     "ellipse",
      position: { x: 300, y: 80 },
      draggable: false,
      deletable: false,
      data: {
        label:       name,
        isReference: true,
        isDNodeIdentity: true,
      },
    };

    // b. Appearances tracker
    const trackerNode = {
      id:       `dnode-tracker-${node_id}`,
      type:     "dnode_tracker",
      position: { x: 100, y: 220 },
      draggable: true,
      data: {
        dnodeId:          node_id,
        dnodeName:        name,
        hostMindmaps: [],
      },
    };

    mindmapDoc = {
      _id:                PREFIX.MINDMAP + mindmap_id,
      type:               "mindmap",
      mindmap_id,
      mindmap_name:       name,
      canvas_id:          sourceCanvasId,
      is_dnode:           true,
      node_id,
      date_last_modified: ts,
      date_created:       ts,
      essence: {
        nodes: [identityNode, trackerNode],
        edges: [],
      },
    };
  }

  // ── 4. Create the node record ────────────────────────────────────────────
  const nodeDoc = {
    _id:                PREFIX.NODE + node_id,
    type:               "node",
    node_id,
    name,
    source_id:          sourceId || null,
    source_type:        isNote ? "note" : "mindmap",
    canvas_id:          sourceCanvasId,
    mind_map_id:        mindmap_id,
    list_of_mindmap_id: hostMindmapId ? [hostMindmapId] : [],
  };

  const puts = [db.put(nodeDoc)];
  if (mindmapDoc) puts.push(db.put(mindmapDoc));

  await Promise.all(puts);

  // ── 5. Sync tracker ONLY if there is a mindmap ──────────────────────────
  if (mindmap_id && hostMindmapId) {
    await _syncTrackerNode(mindmap_id, node_id, nodeDoc.list_of_mindmap_id);
  }

  return { nodeRecord: nodeDoc, mindmap: mindmapDoc };
}

/**
 * promoteMindMapToDNode — converts an existing regular mindmap into a D-node.
 */
export async function promoteMindMapToDNode(mindmapId, hostMindmapId) {
  const mindmapDoc = await db.get(PREFIX.MINDMAP + mindmapId);

  // ── 1. Duplicate check ──────────────────────────────────────────────────
  // If a D-node with this name already exists, we should probably 
  // just link to it rather than creating a new one.
  const existing = await getDNodeByName(mindmapDoc.mindmap_name);
  if (existing) {
    return await _addHostMindmapToDNode(existing.node_id, hostMindmapId);
  }

  const node_id = uuid();
  const ts = now();

  // 2. Build the tracker node
  const trackerNode = {
    id:       `dnode-tracker-${node_id}`,
    type:     "dnode_tracker",
    position: { x: 100, y: 220 },
    draggable: true,
    data: {
      dnodeId:          node_id,
      dnodeName:        mindmapDoc.mindmap_name,
      hostMindmaps: [],
    },
  };

  // 3. Update mindmap doc
  const updatedMindmap = {
    ...mindmapDoc,
    is_dnode:           true,
    node_id,
    date_last_modified: ts,
    essence: {
      ...mindmapDoc.essence,
      nodes: [...(mindmapDoc.essence.nodes || []), trackerNode],
    },
  };

  // 4. Create node record
  const nodeDoc = {
    _id:                PREFIX.NODE + node_id,
    type:               "node",
    node_id,
    name:               mindmapDoc.mindmap_name,
    source_id:          mindmapId,
    canvas_id:          mindmapDoc.canvas_id, // BELONGS TO SOURCE CANVAS
    mind_map_id:        mindmapId,
    list_of_mindmap_id: hostMindmapId ? [hostMindmapId] : [],
  };

  await Promise.all([db.put(updatedMindmap), db.put(nodeDoc)]);

  if (hostMindmapId) {
    await _syncTrackerNode(mindmapId, node_id, nodeDoc.list_of_mindmap_id);
  }

  return { nodeRecord: nodeDoc, mindmap: updatedMindmap };
}

/**
 * registerDNodeInMindmap — call this when an existing D-node is placed into
 * a new mindmap. Updates list_of_mindmap_id and refreshes the tracker node.
 *
 * @param {string} dnodeNodeId   — the node record's node_id
 * @param {string} hostMindmapId — the mindmap the D-node is being added to
 */
export async function registerDNodeInMindmap(dnodeNodeId, hostMindmapId) {
  return _addHostMindmapToDNode(dnodeNodeId, hostMindmapId);
}

/**
 * unregisterDNodeFromMindmap — call this when a D-node instance is removed
 * from a mindmap (e.g. the user deletes that node from the canvas).
 */
export async function unregisterDNodeFromMindmap(dnodeNodeId, hostMindmapId) {
  const nodeDoc = await db.get(PREFIX.NODE + dnodeNodeId);
  const updated = nodeDoc.list_of_mindmap_id.filter((id) => id !== hostMindmapId);
  const savedNode = await db.put({ ...nodeDoc, list_of_mindmap_id: updated });

  // Refresh the tracker node in the D-node's own mindmap (if it has one)
  if (nodeDoc.mind_map_id) {
    await _syncTrackerNode(nodeDoc.mind_map_id, dnodeNodeId, updated);
  }
  return savedNode;
}

/**
 * renameDNode — renames a D-node globally.
 * Updates: node record, D-node mindmap name, identity node label inside the mindmap.
 */
export async function renameDNode(dnodeNodeId, newName) {
  // Check the new name isn't already taken by a different D-node
  const conflict = await getDNodeByName(newName);
  if (conflict && conflict.node_id !== dnodeNodeId) {
    throw new Error(`A D-node named "${newName}" already exists.`);
  }

  const nodeDoc = await db.get(PREFIX.NODE + dnodeNodeId);
  const puts = [db.put({ ...nodeDoc, name: newName })];

  if (nodeDoc.mind_map_id) {
    const mindmapDoc = await db.get(PREFIX.MINDMAP + nodeDoc.mind_map_id);

    // Update identity node label inside the mindmap essence
    const updatedNodes = mindmapDoc.essence.nodes.map((n) =>
      n.data?.isDNodeIdentity
        ? { ...n, data: { ...n.data, label: newName } }
        : n
    );

    puts.push(db.put({
      ...mindmapDoc,
      mindmap_name: newName,
      essence: { ...mindmapDoc.essence, nodes: updatedNodes },
      date_last_modified: now(),
    }));
  }

  await Promise.all(puts);
}

/**
 * deleteDNodeMindmap — deletes a D-node and its mindmap entirely.
 *
 * For every mindmap that contained a D-node instance, the D-node instance
 * node is converted to a regular ellipse node (isDNode: false, isDNodeIdentity
 * removed) so the user doesn't lose the visual structure, just the D-node link.
 */
export async function deleteDNodeMindmap(dnodeNodeId) {
  const nodeDoc = await db.get(PREFIX.NODE + dnodeNodeId);

  // Convert all instances back to regular ellipse nodes
  await Promise.all(
    nodeDoc.list_of_mindmap_id.map((mmId) =>
      _convertDNodeInstancesToEllipse(mmId, dnodeNodeId)
    )
  );

  // Delete the node record and the mindmap (if it has one)
  const deletes = [db.remove(nodeDoc)];
  if (nodeDoc.mind_map_id) {
    const mindmapDoc = await db.get(PREFIX.MINDMAP + nodeDoc.mind_map_id);
    deletes.push(db.remove(mindmapDoc));
  }
  await Promise.all(deletes);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE D-NODE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * _addHostMindmapToDNode — adds a mindmap ID to a D-node's list_of_mindmap_id
 * and refreshes the tracker node. Called by both createDNode (existing name)
 * and registerDNodeInMindmap.
 */
async function _addHostMindmapToDNode(dnodeNodeId, hostMindmapId) {
  const nodeDoc = await db.get(PREFIX.NODE + dnodeNodeId);
  const list = nodeDoc.list_of_mindmap_id.includes(hostMindmapId)
    ? nodeDoc.list_of_mindmap_id
    : [...nodeDoc.list_of_mindmap_id, hostMindmapId];

  await db.put({ ...nodeDoc, list_of_mindmap_id: list });

  // Sync tracker ONLY if there is an associated mindmap
  if (nodeDoc.mind_map_id) {
    await _syncTrackerNode(nodeDoc.mind_map_id, dnodeNodeId, list);
  }

  return {
    nodeRecord: { ...nodeDoc, list_of_mindmap_id: list },
    mindmap: nodeDoc.mind_map_id 
      ? await db.get(PREFIX.MINDMAP + nodeDoc.mind_map_id)
      : null,
  };
}

/**
 * _syncTrackerNode — rebuilds the hostMindmaps array inside the tracker node
 * of a D-node mindmap. Fetches the name and latest D-node position for each
 * host mindmap so the tracker blocks are always up to date.
 *
 * @param {string}   dnodeMindmapId  — the D-node's own mindmap ID
 * @param {string}   dnodeNodeId     — the node record ID
 * @param {string[]} hostMindmapIds  — current list of host mindmap IDs
 */
async function _syncTrackerNode(dnodeMindmapId, dnodeNodeId, hostMindmapIds) {
  const mindmapDoc = await db.get(PREFIX.MINDMAP + dnodeMindmapId);

  // Build hostMindmaps entries — fetch name + find the D-node's position
  const hostMindmaps = await Promise.all(
    hostMindmapIds.map(async (mmId) => {
      const mm = await getMindMap(mmId);
      if (!mm) return null;

      // Find the D-node instance inside this host mindmap to get its x/y
      const instanceNode = mm.essence?.nodes?.find(
        (n) => n.data?.dnodeNodeId === dnodeNodeId
      );

      return {
        mindmap_id:   mmId,
        mindmap_name: mm.mindmap_name,
        x: instanceNode?.position?.x ?? 0,
        y: instanceNode?.position?.y ?? 0,
      };
    })
  );

  // Filter out nulls (mindmaps that were deleted)
  const validHosts = hostMindmaps.filter(Boolean);

  // Update the tracker node's data
  const updatedNodes = mindmapDoc.essence.nodes.map((n) =>
    n.type === "dnode_tracker"
      ? { ...n, data: { ...n.data, hostMindmaps: validHosts } }
      : n
  );

  await db.put({
    ...mindmapDoc,
    essence: { ...mindmapDoc.essence, nodes: updatedNodes },
    date_last_modified: now(),
  });
}

/**
 * _convertDNodeInstancesToEllipse — in a given mindmap, finds all nodes that
 * are instances of a specific D-node and strips their D-node data, leaving
 * behind a regular ellipse node with the same label and position.
 */
async function _convertDNodeInstancesToEllipse(mindmapId, dnodeNodeId) {
  try {
    const mm = await db.get(PREFIX.MINDMAP + mindmapId);
    const updatedNodes = mm.essence.nodes.map((n) => {
      if (n.data?.dnodeNodeId !== dnodeNodeId) return n;
      // Strip all D-node specific data, keep label and position
      return {
        ...n,
        type: "ellipse",
        data: {
          label:       n.data.label || n.data.dnodeName || "Node",
          bgColor:     n.data.bgColor,
          // Remove all D-node fields
          isDNode:     undefined,
          dnodeNodeId: undefined,
          dnodeName:   undefined,
          dnodeMindmapId: undefined,
        },
      };
    });
    await db.put({
      ...mm,
      essence: { ...mm.essence, nodes: updatedNodes },
      date_last_modified: now(),
    });
  } catch {
    // Mindmap may have been deleted already — ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE CRUD  (kept for direct access if needed)
// ─────────────────────────────────────────────────────────────────────────────

export async function getNodesForCanvas(canvasId) {
  const docs = await fetchByPrefix(PREFIX.NODE);
  return docs.filter((d) => d.canvas_id === canvasId);
}

export async function deleteNode(nodeId) {
  const doc = await db.get(PREFIX.NODE + nodeId);
  await db.remove(doc);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function _touchCanvas(canvasId) {
  try {
    const doc = await db.get(PREFIX.CANVAS + canvasId);
    await db.put({ ...doc, date_last_modified: now() });
  } catch { /* canvas may have been deleted */ }
}