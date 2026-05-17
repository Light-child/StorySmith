/**
 * NoteEditor.jsx — Rich Text Editor
 * ────────────────────────────────────
 * Wraps TipTap. Loads the active note from the Zustand store,
 * auto-saves to PouchDB via the store's persistNote action.
 *
 * Key fixes:
 *   - debouncedSave uses a ref so the TipTap onUpdate callback never
 *     goes stale — no stale closure bug, no missed saves.
 *   - essence is already a plain JS object from PouchDB (no JSON.parse).
 *   - setContent is only called when the note ID actually changes,
 *     preventing the cursor jumping while the user is typing.
 */

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

import useStore from "../../State/useStore";
import styles from "./NoteEditor.module.css";

export default function NoteEditor() {
  // ── Store subscriptions ───────────────────────────────────────────────────
  const notes        = useStore((s) => s.notes);
  const activeNoteId = useStore((s) => s.activeNoteId);
  const persistNote  = useStore((s) => s.persistNote);

  // Derive the active note object
  const activeNote = notes.find((n) => n.note_id === activeNoteId) || null;

  // ── Refs ──────────────────────────────────────────────────────────────────
  // Keeping persistNote and activeNoteId in refs means the TipTap onUpdate
  // callback can always read the latest values without being recreated,
  // which would reset the editor and lose the user's cursor position.
  const persistNoteRef  = useRef(persistNote);
  const activeNoteIdRef = useRef(activeNoteId);
  const debounceTimer   = useRef(null);

  useEffect(() => { persistNoteRef.current  = persistNote;  }, [persistNote]);
  useEffect(() => { activeNoteIdRef.current = activeNoteId; }, [activeNoteId]);

  // ── TipTap editor ─────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Begin your story…" }),
    ],

    content: "", // real content is loaded by the effect below

    onUpdate: ({ editor }) => {
      // Debounce: save 1.5s after the user stops typing
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const id = activeNoteIdRef.current;
        if (id) {
          // getJSON() returns a plain object — PouchDB stores it directly
          persistNoteRef.current(id, editor.getJSON());
        }
      }, 1500);
    },
  });

  // ── Load content when the active note changes ─────────────────────────────
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    if (!activeNote) {
      editor.commands.setContent("");
      return;
    }

    // essence comes from PouchDB as a plain JS object — use it directly.
    // Fall back to empty doc if missing or malformed.
    const content =
      activeNote.essence &&
      typeof activeNote.essence === "object" &&
      activeNote.essence.type === "doc"
        ? activeNote.essence
        : { type: "doc", content: [] };

    // Only update the editor if the content genuinely differs.
    // This prevents the cursor jumping to position 0 mid-typing
    // when the auto-save fires and updates the store.
    const currentJson  = JSON.stringify(editor.getJSON());
    const incomingJson = JSON.stringify(content);
    if (currentJson !== incomingJson) {
      editor.commands.setContent(content, false); // false = don't fire onUpdate
    }
  }, [activeNoteId, editor]); // only re-run when the selected note ID changes

  // ── Clean up timer on unmount ─────────────────────────────────────────────
  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  // ── Toolbar button ────────────────────────────────────────────────────────
  const ToolbarBtn = ({ action, label, isActive }) => (
    <button
      className={`${styles.toolBtn} ${isActive ? styles.toolBtnActive : ""}`}
      onClick={action}
      title={label}
    >
      {label}
    </button>
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!activeNoteId) {
    return (
      <div className={styles.empty}>
        <p>Select a note from the sidebar, or create a new one.</p>
      </div>
    );
  }

  // ── Editor UI ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.root}>

      {editor && (
        <div className={styles.toolbar}>
          <ToolbarBtn label="B"      action={() => editor.chain().focus().toggleBold().run()}                  isActive={editor.isActive("bold")} />
          <ToolbarBtn label="I"      action={() => editor.chain().focus().toggleItalic().run()}                isActive={editor.isActive("italic")} />
          <ToolbarBtn label="H1"     action={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}   isActive={editor.isActive("heading", { level: 1 })} />
          <ToolbarBtn label="H2"     action={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}   isActive={editor.isActive("heading", { level: 2 })} />
          <ToolbarBtn label="• List" action={() => editor.chain().focus().toggleBulletList().run()}            isActive={editor.isActive("bulletList")} />
          <ToolbarBtn label="1. List"action={() => editor.chain().focus().toggleOrderedList().run()}           isActive={editor.isActive("orderedList")} />
          <ToolbarBtn label="Code"   action={() => editor.chain().focus().toggleCodeBlock().run()}             isActive={editor.isActive("codeBlock")} />
          <ToolbarBtn label="— Rule" action={() => editor.chain().focus().setHorizontalRule().run()}           isActive={false} />
        </div>
      )}

      <EditorContent editor={editor} className={styles.editorContent} />

    </div>
  );
}