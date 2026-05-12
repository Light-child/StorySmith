import { useState } from "react";
import { Handle, Position, NodeToolbar } from "reactflow";
import { THEMES } from "../themes";
import styles from "./IdentityNode.module.css";
import useStore from "../../../State/useStore";

const IdentityNode = ({ data, id, selected }) => {
  const [showPalette, setShowPalette] = useState(false);
  const themeKey = data.bgColor || "classical";
  const theme = THEMES[themeKey];

  const colors = [
    { name: "Classical", key: "classical" },
    { name: "Blue",      key: "blue"      },
    { name: "Purple",    key: "purple"    },
    { name: "Green",     key: "green"     },
    { name: "Yellow",    key: "yellow"    },
    { name: "Red",       key: "red"       },
  ];

  const handleColorChange = async (colorKey) => {
    if (data.dnodeId) {
      await useStore.getState().syncDNodeStyle(data.dnodeId, colorKey);
    }
    setShowPalette(false);
  };

  return (
    <div className={`${styles.root} ${selected ? styles.selected : ""}`}>
      
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <NodeToolbar
        isVisible={selected}
        position={Position.Right}
        className="flex flex-col gap-2 bg-gray-900 p-2 shadow-xl rounded-lg border border-gray-700"
      >
        <div className="flex gap-2">
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="p-1 rounded text-xs nodrag text-gray-300 hover:bg-gray-800"
            title="Choose colour"
          >
            🎨
          </button>
        </div>

        {showPalette && (
          <div className="flex gap-1 p-1 bg-gray-800 rounded border border-gray-700 nodrag">
            {colors.map((c) => (
              <button
                key={c.key}
                onClick={() => handleColorChange(c.key)}
                style={{
                  backgroundColor: THEMES[c.key].bg,
                  borderColor:     THEMES[c.key].border,
                }}
                className="w-5 h-5 rounded-full border-2 hover:scale-110 transition-transform"
              />
            ))}
          </div>
        )}
      </NodeToolbar>

      <Handle type="target" position={Position.Top} id="t" className={styles.handle} />
      <Handle type="source" position={Position.Bottom} id="b" className={styles.handle} />
      <Handle type="target" position={Position.Left} id="l" className={styles.handle} />
      <Handle type="source" position={Position.Right} id="r" className={styles.handle} />

      <div
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.border,
          boxShadow: selected
            ? `0 0 0 2px ${theme.ring}, 0 0 20px rgba(126,34,206,0.6)`
            : "0 0 15px rgba(126,34,206,0.3)",
        }}
        className={styles.body}
      >
        <div className={styles.badge}>IDENTITY</div>
        <div className={styles.label}>{data.label || data.dnodeName}</div>
      </div>
    </div>
  );
};

export default IdentityNode;
