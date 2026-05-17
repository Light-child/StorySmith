import React from 'react';
import useStore from '../State/useStore';
import styles from './Breadcrumbs.module.css';

export default function Breadcrumbs() {
  const navigationPath = useStore((s) => s.navigationPath);
  const jumpToPathIndex = useStore((s) => s.jumpToPathIndex);

  if (navigationPath.length <= 0) return null;

  return (
    <nav className={styles.root}>
      {navigationPath.map((item, index) => (
        <React.Fragment key={`${item.id}-${index}`}>
          {index > 0 && <span className={styles.separator}>/</span>}
          <button
            className={`${styles.crumb} ${index === navigationPath.length - 1 ? styles.active : ''}`}
            onClick={() => jumpToPathIndex(index)}
            disabled={index === navigationPath.length - 1}
          >
            {item.name}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}
