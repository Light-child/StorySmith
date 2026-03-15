// fileStorage.js — Manual JSON export/import for sharing & backup.
// PouchDB handles automatic persistence; these functions are for
// deliberately exporting a mindmap to a .json file or loading one back in.
// Called from MindMapView.jsx via the MindMapToolbar.

/**
 * exportToJson — downloads the full allData object as a .json file.
 * @param {object} allData — the full multi-level mindmap state from useMindMap
 */
export const exportToJson = (allData) => {
  if (!allData) return;

  const dataStr = JSON.stringify(allData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `storysmith-mindmap-${new Date().toLocaleDateString()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * importFromJson — reads a .json file and restores mindmap state from it.
 * Overwrites the current allData after a confirmation prompt if data exists.
 *
 * @param {Event}    event        — the file input onChange event
 * @param {object}   allData      — current mindmap state (for the overwrite check)
 * @param {Function} setAllData   — from useMindMap
 * @param {Function} setPath      — from useMindMap
 * @param {Function} setIsDirty   — from useMindMap
 */
export const importFromJson = (event, { allData, setAllData, setPath, setIsDirty }) => {
  const file = event.target.files[0];
  if (!file) return;

  // Warn the user if they'd be overwriting existing work
  const hasExistingData =
    allData?.root?.nodes?.length > 1 ||
    allData?.root?.edges?.length > 0 ||
    Object.keys(allData || {}).length > 1;

  if (hasExistingData) {
    const confirmOverwrite = window.confirm(
      "You already have a mind map in progress. Loading a new file will replace your current work. Continue?"
    );
    if (!confirmOverwrite) {
      event.target.value = '';
      return;
    }
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target.result);
      setAllData(json);
      setIsDirty(false);
      setPath([{ id: 'root', name: 'Home' }]);
      event.target.value = ''; // allow re-importing the same file later
    } catch (err) {
      alert("Error parsing JSON file. Please ensure it's a valid StorySmith mind-map file.");
      console.error(err);
    }
  };
  reader.readAsText(file);
};
