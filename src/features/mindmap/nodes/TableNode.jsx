// nodes/TableNode.jsx — Spreadsheet-style table node
// Supports adding rows/columns and inline cell editing.

import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';

const TableNode = ({ data, id, selected }) => {
  const [tableData, setTableData] = useState(data.tableData || {
    headers: ['Header 1', 'Header 2'],
    rows: [['', '']]
  });

  const isReference = data.isReference;

  // Sync internal state when props change (e.g. after JSON import)
  useEffect(() => {
    if (data.tableData) setTableData(data.tableData);
  }, [data.tableData]);

  // Push local changes up to useMindMap via the data callback
  const updateGlobal = (updatedTable) => {
    setTableData(updatedTable);
    if (data.onLabelChange) data.onLabelChange(id, updatedTable);
  };

  const addColumn = () => {
    const newHeaders = [...tableData.headers, `Header ${tableData.headers.length + 1}`];
    const newRows = tableData.rows.map(row => [...row, '']);
    updateGlobal({ headers: newHeaders, rows: newRows });
  };

  const addRow = () => {
    const newRows = [...tableData.rows, Array(tableData.headers.length).fill('')];
    updateGlobal({ ...tableData, rows: newRows });
  };

  const handleCellChange = (rowIndex, colIndex, value, isHeader = false) => {
    const updated = { ...tableData };
    if (isHeader) updated.headers[colIndex] = value;
    else updated.rows[rowIndex][colIndex] = value;
    updateGlobal(updated);
  };

  return (
    <div
      className={`bg-gray-900 rounded-lg shadow-xl overflow-visible flex flex-col min-w-[250px] h-full w-full
        ${selected ? 'border-blue-500 ring-2 ring-blue-500/40' : 'border-gray-700'}`}
    >
      <NodeResizer color="#ffffff" isVisible={selected} minWidth={250} />
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <div className="flex-1 overflow-auto nowheel">
        <table className="w-full border-collapse bg-gray-900 h-full">
          <thead>
            <tr>
              {tableData.headers.map((h, i) => (
                <th key={i} className="border border-gray-700 p-0 bg-gray-800">
                  <input
                    className="nodrag w-full h-full bg-transparent outline-none font-bold text-center text-gray-100 p-2 cursor-text text-sm"
                    value={h}
                    onChange={(e) => handleCellChange(null, i, e.target.value, true)}
                    readOnly={isReference}
                  />
                </th>
              ))}
              {!isReference && (
                <th className="border border-gray-700 p-0 bg-gray-800 w-10">
                  <button onClick={addColumn} className="nodrag w-full h-full text-blue-400 hover:bg-blue-500/20 transition-colors font-bold">+</button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, colIndex) => (
                  <td key={colIndex} className="border border-gray-700 p-0">
                    <input
                      className="nodrag w-full bg-transparent outline-none p-2 cursor-text text-base text-gray-200"
                      value={cell}
                      onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                      readOnly={isReference}
                    />
                  </td>
                ))}
                {!isReference && <td className="border border-gray-700 bg-gray-800/50" />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isReference && (
        <div className="px-2 flex shrink-0">
          <button onClick={addRow} className="nodrag text-[10px] uppercase tracking-wider bg-gray-900 hover:bg-blue-500/20 text-blue-400 px-3 py-1 rounded border border-blue-500/40 transition-colors font-bold">
            + Add Row
          </button>
        </div>
      )}

      <Handle type="target" position={Position.Top}    id="t"  className="w-3 h-3 !bg-blue-500 border-2 border-white" />
      <Handle type="source" position={Position.Top}    id="ts" className="w-3 h-3 !bg-blue-500 border-2 border-white opacity-0" />
      <Handle type="target" position={Position.Bottom} id="b"  className="w-3 h-3 !bg-blue-500 border-2 border-white" />
      <Handle type="source" position={Position.Bottom} id="bs" className="w-3 h-3 !bg-blue-500 border-2 border-white" />
      <Handle type="target" position={Position.Left}   id="l"  className="w-3 h-3 !bg-blue-500 border-2 border-white" />
      <Handle type="source" position={Position.Left}   id="ls" className="w-3 h-3 !bg-blue-500 border-2 border-white" />
      <Handle type="target" position={Position.Right}  id="r"  className="w-3 h-3 !bg-blue-500 border-2 border-white" />
      <Handle type="source" position={Position.Right}  id="rs" className="w-3 h-3 !bg-blue-500 border-2 border-white" />
    </div>
  );
};

export default TableNode;
