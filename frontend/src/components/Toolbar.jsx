import React from 'react';
import useStore from '../store';
import { v4 as uuidv4 } from 'uuid';

export default function Toolbar() {
  const { autoNodeEnabled, toggleAutoNode, nodes, setNodes, saveCurrentToHistory, addNode } = useStore();

  const handleNewConversation = () => {
    // 保存当前画布到历史（如果有对话节点）
    saveCurrentToHistory();
    // 清空画布，只保留 Agent 根节点
    const agentRoots = nodes.filter(n => n.type === 'agent');
    setNodes(agentRoots);
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
