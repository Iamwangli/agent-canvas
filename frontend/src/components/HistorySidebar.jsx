import React from 'react';
import useStore from '../store';

export default function HistorySidebar() {
  const { history, restoreFromHistory, deleteHistoryItem } = useStore();

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="absolute left-4 top-20 bottom-4 w-64 bg-white shadow-lg rounded-lg overflow-y-auto z-10 p-2 border border-gray-200">
      <div className="text-sm font-bold mb-2 text-gray-600">历史对话</div>
      {history.map(item => (
        <div key={item.id} className="mb-2 p-2 border rounded hover:bg-gray-50 group">
          <div className="text-sm truncate">{item.name}</div>
          <div className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => restoreFromHistory(item.id)}
              className="text-xs text-blue-500 hover:underline"
            >
              恢复
            </button>
            <button
              onClick={() => deleteHistoryItem(item.id)}
              className="text-xs text-red-500 hover:underline"
            >
              删除
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
