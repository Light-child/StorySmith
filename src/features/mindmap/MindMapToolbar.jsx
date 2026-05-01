// MindMapToolbar.jsx — Add Node button with dropdown (now includes D-Node)

import React, { useState, useEffect, useRef } from 'react';
import styles from './MindMapToolbar.module.css';

const NODE_TYPES = [
  { type: 'ellipse',   label: 'General',   iconClass: 'iconEllipse' },
  { type: 'circle',    label: 'Character', iconClass: 'iconCircle'  },
  { type: 'rectangle', label: 'Attribute', iconClass: 'iconRect'    },
  { type: 'table',     label: 'Table',     iconClass: 'iconTable'   },
];

const MindMapToolbar = ({ onAddNode, onExport, onImport, onOpenDNodePanel }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (type) => {
    onAddNode(type);
    setOpen(false);
  };

  return (
    <div className={styles.wrapper} ref={ref}>

      <button
        className={`${styles.triggerBtn} ${open ? styles.triggerBtnOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Add node"
      >
        <span className={`${styles.plusIcon} ${open ? styles.plusIconOpen : ''}`}>＋</span>
        Add Node
      </button>

      {open && (
        <div className={styles.dropdown}>
          {/* Regular node types */}
          {NODE_TYPES.map(({ type, label, iconClass }) => (
            <button
              key={type}
              className={styles.dropdownItem}
              onClick={() => handleSelect(type)}
            >
              <span className={`${styles.icon} ${styles[iconClass]}`} />
              {label}
            </button>
          ))}

          {/* D-Node — opens the right panel instead of placing directly */}
          <div className={styles.divider} />
          <button
            className={`${styles.dropdownItem} ${styles.dnodeItem}`}
            onClick={() => { onOpenDNodePanel?.(); setOpen(false); }}
          >
            <span className={`${styles.icon} ${styles.iconDNode}`} />
            D-Node
          </button>

          {/* File actions */}
          <div className={styles.divider} />
          <button className={`${styles.dropdownItem} ${styles.fileItem}`}
            onClick={() => { onExport(); setOpen(false); }}>
            Export .json
          </button>
          <label className={`${styles.dropdownItem} ${styles.fileItem}`}>
            Import .json
            <input type="file" accept=".json"
              onChange={(e) => { onImport(e); setOpen(false); }}
              className={styles.hiddenInput} />
          </label>
        </div>
      )}
    </div>
  );
};

export default MindMapToolbar;