/**
 * CollectionGrid.jsx — Reusable grid of canvas cards
 * ─────────────────────────────────────────────────────
 * This is a presentational component used by HomePage.
 * It receives an array of canvases and renders them as cards.
 * It also renders the "Create New Canvas" card at the end.
 *
 * Props:
 *   canvases  — array of canvas objects from the store
 *   onCreate  — called when user clicks "Create New Canvas"
 *   onOpen    — called with a canvas object when user clicks a card
 *   onDelete  — called with a canvas id when user deletes a card
 */

import styles from "./CollectionGrid.module.css";

// ─── Format date helper ───────────────────────────────────────────────────────
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "—");

// ─── Individual card ──────────────────────────────────────────────────────────
function CanvasCard({ canvas, onOpen, onDelete }) {
  return (
    <div className={styles.card} onClick={() => onOpen(canvas)}>
      {/* Thumbnail — solid accent block as placeholder */}
      <div className={styles.thumb} />

      {/* Info */}
      <div className={styles.info}>
        <h3 className={styles.name}>{canvas.name}</h3>
        <p className={styles.meta}>Modified: {fmt(canvas.date_last_modified)}</p>
        <p className={styles.meta}>Created: {fmt(canvas.date_created)}</p>
      </div>

      {/* Delete button */}
      <button
        className={styles.del}
        onClick={(e) => { e.stopPropagation(); onDelete(canvas.id); }}
        title="Delete"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Create card ──────────────────────────────────────────────────────────────
function CreateCard({ onCreate }) {
  return (
    <div className={styles.createCard} onClick={onCreate}>
      <span className={styles.plus}>＋</span>
      <span className={styles.createLabel}>Create New Canvas</span>
    </div>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────
export default function CollectionGrid({ canvases, onCreate, onOpen, onDelete }) {
  return (
    <div className={styles.grid}>
      {canvases.map((c) => (
        <CanvasCard key={c.id} canvas={c} onOpen={onOpen} onDelete={onDelete} />
      ))}
      <CreateCard onCreate={onCreate} />
    </div>
  );
}
