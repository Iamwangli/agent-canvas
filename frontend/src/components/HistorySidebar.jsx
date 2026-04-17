import React from 'react';
import useStore from '../store';

export default function HistorySidebar() {
  const { files, currentFileId, restoreFile, deleteFile } = useStore();

  // 过滤掉没有对话节点的文件（即只有根节点或空文件）
  const visibleFiles = files.filter(file => file.nodes.some(n => n.type === 'conversation'));

  if (visibleFiles.length === 0) return null;

  return (
    <div className="absolute left-4 top-20 bottom-4 w-64 bg-white shadow-lg rounded-lg overflow-y-auto z-10 p-2 border border-gray-200">
      <div className="text-sm font-bold mb-2 text-gray-600">历史对话</div>
      {visibleFiles.map(file => (
        <div
          key={file.id}
          className={`mb-2 p-2 border rounded hover:bg-gray-50 ${currentFileId === file.id ? 'bg-blue-100' : ''}`}
        >
          <div className="text-sm truncate">{file.name}</div>
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
