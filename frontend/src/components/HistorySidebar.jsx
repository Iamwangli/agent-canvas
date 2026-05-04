import React, { useState } from 'react';
import useStore from '../store';

export default function HistorySidebar() {
  const { files, currentFileId, restoreFile, deleteFile, updateFileName } = useStore();
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const visibleFiles = files.filter(file => file.nodes.some(n => n.type === 'conversation'));

  const startRename = (fileId, currentName) => {
    setEditingId(fileId);
    setEditValue(currentName);
  };

  const saveRename = (fileId) => {
    const newName = editValue.trim();
    if (newName && newName !== '') {
      updateFileName(fileId, newName);
    }
    setEditingId(null);
  };

  const handleKeyDown = (e, fileId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRename(fileId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  if (visibleFiles.length === 0) return null;

  return (
    <div className="absolute left-4 top-20 bottom-4 w-64 bg-white shadow-lg rounded-lg overflow-y-auto z-10 p-2 border border-gray-200">
      <div className="text-sm font-bold mb-2 text-gray-600">历史对话</div>
      {visibleFiles.map(file => (
        <div
          key={file.id}
          className={`mb-2 p-2 border rounded hover:bg-gray-50 ${currentFileId === file.id ? 'bg-blue-100' : ''}`}
        >
          {editingId === file.id ? (
            <input
              className="text-sm w-full border border-blue-400 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => saveRename(file.id)}
              onKeyDown={(e) => handleKeyDown(e, file.id)}
              autoFocus
            />
          ) : (
            <div
              className="text-sm truncate cursor-pointer hover:text-blue-600"
              onDoubleClick={() => startRename(file.id, file.name)}
              title="双击重命名"
            >
              {file.name}
            </div>
          )}
          <div className="text-xs text-gray-400">{new Date(file.createdAt).toLocaleString()}</div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => restoreFile(file.id)} className="text-xs text-blue-500 hover:underline">恢复</button>
            <button onClick={() => deleteFile(file.id)} className="text-xs text-red-500 hover:underline">删除</button>
          </div>
        </div>
      ))}
    </div>
  );
}
