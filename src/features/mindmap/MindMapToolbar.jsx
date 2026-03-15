// MindMapToolbar.jsx — Add Node button with dropdown menu
// Sits in the top-left corner of the React Flow canvas.
// Clicking the button opens a dropdown listing all node types.
// Clicking outside the dropdown closes it.

import React, { useState, useEffect, useRef } from 'react';
import styles from './MindMapToolbar.module.css';

// Node type definitions — label, a CSS modifier class for the icon shape
const NODE_TYPES = [
  { type: 'ellipse',   label: 'General',   iconClass: 'iconEllipse' },
  { type: 'circle',    label: 'Character', iconClass: 'iconCircle'  },
  { type: 'rectangle', label: 'Attribute', iconClass: 'iconRect'    },
  { type: 'table',     label: 'Table',     iconClass: 'iconTable'   },
];

const MindMapToolbar = ({ onAddNode, onExport, onImport }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown when user clicks anywhere outside the toolbar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (type) => {
    onAddNode(type);
    setOpen(false); // close after selecting
  };

  return (
    <div className={styles.wrapper} ref={ref}>

      {/* ── Trigger button ──────────────────────────────────────────── */}
      <button
        className={`${styles.triggerBtn} ${open ? styles.triggerBtnOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Add node"
      >
        {/* Plus icon — rotates to × when open */}
        <span className={`${styles.plusIcon} ${open ? styles.plusIconOpen : ''}`}>＋</span>
        Add Node
      </button>

      {/* ── Dropdown ────────────────────────────────────────────────── */}
      {open && (
        <div className={styles.dropdown}>
          {NODE_TYPES.map(({ type, label, iconClass }) => (
            <button
              key={type}
              className={styles.dropdownItem}
              onClick={() => handleSelect(type)}
            >
              {/* Small shape icon hinting at the node type */}
              <span className={`${styles.icon} ${styles[iconClass]}`} />
              {label}
            </button>
          ))}

          {/* Divider + file actions kept accessible but unobtrusive */}
          <div className={styles.divider} />

          <button className={`${styles.dropdownItem} ${styles.fileItem}`} onClick={() => { onExport(); setOpen(false); }}>
            Export .json
          </button>

          <label className={`${styles.dropdownItem} ${styles.fileItem}`}>
            Import .json
            <input type="file" accept=".json" onChange={(e) => { onImport(e); setOpen(false); }} className={styles.hiddenInput} />
          </label>
        </div>
      )}

    </div>
  );
};

export default MindMapToolbar;