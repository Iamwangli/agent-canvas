import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import ReactMarkdown from 'react-markdown';
import useStore from '../store';
import { sendMessage } from '../api';
import { collectContext, findNearestAgentId } from '../utils/graphUtils';

export default function ConversationNode({ id, data }) {
  const [question, setQuestion] = useState(data.question || '');
  const [isEditing, setIsEditing] = useState(!data.answer);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef(null);
  const updateNode = useStore(state => state.updateNode);
  const getCurrentNodes = useStore(state => state.getCurrentNodes);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSend = async () => {
    if (!question.trim() || isSending) return;
    
    setIsSending(true);
    try {
      const allNodes = getCurrentNodes(); // 获取当前文件的所有节点
      const node = allNodes.find(n => n.id === id);
      if (!node) return;
      
      const context = collectContext(allNodes, node.parentId);
      
      let agentId = node.agentId;
      if (!agentId) {
        const nearest = findNearestAgentId(allNodes, id);
        if (!nearest) {
          alert('该节点未连接到任何 Agent，请先连接至 Agent 根节点');
          setIsSending(false);
          return;
        }
        agentId = nearest;
      }
      
      const { answer } = await sendMessage(agentId, question, context);
      updateNode(id, { question, answer });
      setIsEditing(false);
    } catch (error) {
      console.error('发送失败', error);
      alert('发送失败：' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (data.answer) {
    return (
      <div className={`conversation-node ${data.hidden ? 'node-hidden' : ''} ${data.isAutoCreated ? 'auto-created' : ''}`}>
        <Handle type="target" position={Position.Top} id="target" />
        <div className="p-2 border-b bg-gray-50 text-sm font-medium">问题</div>
        <div className="p-2 text-sm whitespace-pre-wrap">{data.question}</div>
        <div className="p-2 border-t bg-gray-50 text-sm font-medium">回复</div>
        <div className="p-2 text-sm prose max-w-none">
          <ReactMarkdown>{data.answer}</ReactMarkdown>
        </div>
        <Handle type="source" position={Position.Bottom} id="source" />
      </div>
    );
  }

  return (
    <div className="conversation-node">
      <Handle type="target" position={Position.Top} id="target" />
      <div className="p-2 bg-blue-50 text-sm font-medium">新对话</div>
      <textarea
        ref={inputRef}
        className="w-full p-2 text-sm border-0 focus:ring-0 resize-none"
        rows={3}
        placeholder="输入您的问题..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSending}
      />
      <button
        className="m-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-400"
        onClick={handleSend}
        disabled={isSending}
      >
        {isSending ? '发送中...' : '发送'}
      </button>
      <Handle type="source" position={Position.Bottom} id="source" />
    </div>
  );
}
