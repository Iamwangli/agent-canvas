import React, { useState } from 'react';
import useStore from '../store';

export default function HistorySidebar() {
  const { files, currentFileId, restoreFile, deleteFile, updateFileName } = useStore();
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [collapsed, setCollapsed] = useState(false);

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
    <div
      className={`absolute left-4 top-20 z-10 w-64 transition-all duration-300 ease-in-out ${
        collapsed ? 'h-10' : 'bottom-4'
      }`}
    >
      <div className="h-full bg-white shadow-lg rounded-lg border border-gray-200 overflow-hidden">
        {/* 标题栏（始终显示） */}
        <div className="flex items-center justify-between px-3 py-1 bg-gray-50 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-600">
            {collapsed ? '历史对话' : '历史对话'}
          </span>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-gray-600 text-xs px-1 py-0.5 rounded hover:bg-gray-200"
            title={collapsed ? '展开' : '收起'}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>

        {/* 列表区域（折叠时隐藏） */}
        {!collapsed && (
          <div className="p-2 overflow-y-auto" style={{ height: 'calc(100% - 2rem)' }}>
            {visibleFiles.map(file => (
              <div
                key={file.id}
                className={`mb-2 p-2 border rounded hover:bg-gray-50 ${
                  currentFileId === file.id ? 'bg-blue-100' : ''
                }`}
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
        )}
      </div>
    </div>
  );
}
