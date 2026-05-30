import React from 'react';
import useStore from '../store';

export default function Toolbar() {
  const { autoNodeEnabled, toggleAutoNode, createNewFile } = useStore();

  const handleNewConversation = () => {
    createNewFile();
  };

  return (
    <div className="absolute top-4 left-4 z-10 bg-white shadow-md rounded-lg p-2 flex items-center gap-2">
      {/* 小图标：三个节点图形 */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="10 5 45 40"
        width="28"
        height="28"
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient id="icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#2563eb', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#06b6d4', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <circle cx="25" cy="25" r="8" fill="url(#icon-grad)" />
        <circle cx="45" cy="15" r="6" fill="url(#icon-grad)" />
        <circle cx="45" cy="35" r="6" fill="url(#icon-grad)" />
        <line x1="32" y1="22" x2="40" y2="16" stroke="url(#icon-grad)" strokeWidth="2" />
        <line x1="32" y1="28" x2="40" y2="34" stroke="url(#icon-grad)" strokeWidth="2" />
      </svg>

      <button
        onClick={handleNewConversation}
        className="px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600"
      >
        + 新对话
      </button>
      <button
        onClick={toggleAutoNode}
        className={`px-3 py-1 rounded-md text-sm font-medium ${
          autoNodeEnabled ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
        }`}
      >
        🤖 AI自动节点 {autoNodeEnabled ? '开' : '关'}
      </button>
    </div>
  );
}
