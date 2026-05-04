import React from 'react';
import useStore from '../store';

export default function Toolbar() {
  const { autoNodeEnabled, toggleAutoNode, createNewFile } = useStore();

  const handleNewConversation = () => {
    createNewFile();
  };

  return (
    <div className="absolute top-4 left-4 z-10 bg-white shadow-md rounded-lg p-2 flex gap-2">
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
