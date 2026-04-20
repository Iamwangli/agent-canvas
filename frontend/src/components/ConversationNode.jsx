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
  const fileInputRef = useRef(null);
  
  const updateNode = useStore(state => state.updateNode);
  const getCurrentNodes = useStore(state => state.getCurrentNodes);
  const incrementAutoCount = useStore(state => state.incrementAutoCount);
  const getAutoCount = useStore(state => state.getAutoCount);
  const resetAutoCount = useStore(state => state.resetAutoCount);
  const autoNodeEnabled = useStore(state => state.autoNodeEnabled);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.txt')) {
      alert('请上传 .txt 文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setQuestion(content);
    };
    reader.readAsText(file, 'UTF-8');
    // 清空 input，允许重复上传同一文件
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!question.trim() || isSending) return;
    
    setIsSending(true);
    try {
      const allNodes = getCurrentNodes();
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
        updateNode(id, { agentId });
      }
      
      const { answer, autoAction } = await sendMessage(agentId, question, context);
      updateNode(id, { question, answer });
      setIsEditing(false);
      
      // 处理自动节点创建
      if (autoNodeEnabled && autoAction) {
        const parentNode = allNodes.find(n => n.id === node.parentId) || node;
        const currentCount = getAutoCount(parentNode.id);
        if (currentCount >= 3) {
          const allow = window.confirm('AI 想要继续创建节点，是否允许？');
          if (!allow) {
            setIsSending(false);
            return;
          }
          resetAutoCount(parentNode.id);
        }
        incrementAutoCount(parentNode.id);
        
        // 自动创建节点逻辑稍后在 App 层处理，这里通过事件或 store 触发
        // 为简化，直接在 store 中提供方法，由 App 监听 answer 中的 autoAction
        // 但这里采用更简单的方式：通过自定义事件通知 App
        window.dispatchEvent(new CustomEvent('auto-create-node', {
          detail: {
            parentId: parentNode.id,
            agentName: autoAction.targetAgentName,
            question: autoAction.question
          }
        }));
      }
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

  // 渲染只读状态（已有回复）
  if (data.answer) {
    return (
      <div className={`conversation-node ${data.hidden ? 'node-hidden' : ''} ${data.isAutoCreated ? 'auto-created' : ''}`}>
        {/* 四个方向的 target Handle */}
        <Handle type="target" position={Position.Top} id="target-top" style={{ background: '#9ca3af' }} />
        <Handle type="target" position={Position.Right} id="target-right" style={{ background: '#9ca3af' }} />
        <Handle type="target" position={Position.Bottom} id="target-bottom" style={{ background: '#9ca3af' }} />
        <Handle type="target" position={Position.Left} id="target-left" style={{ background: '#9ca3af' }} />
        
        <div className="p-2 border-b bg-gray-50 text-sm font-medium">问题</div>
        <div className="p-2 text-sm whitespace-pre-wrap">{data.question}</div>
        <div className="p-2 border-t bg-gray-50 text-sm font-medium">回复</div>
        <div className="p-2 text-sm prose max-w-none">
          <ReactMarkdown>{data.answer}</ReactMarkdown>
        </div>
        
        {/* 四个方向的 source Handle */}
        <Handle type="source" position={Position.Top} id="source-top" style={{ background: '#9ca3af' }} />
        <Handle type="source" position={Position.Right} id="source-right" style={{ background: '#9ca3af' }} />
        <Handle type="source" position={Position.Bottom} id="source-bottom" style={{ background: '#9ca3af' }} />
        <Handle type="source" position={Position.Left} id="source-left" style={{ background: '#9ca3af' }} />
      </div>
    );
  }

  // 渲染编辑状态（新建节点）
  return (
    <div className="conversation-node">
      <Handle type="target" position={Position.Top} id="target-top" style={{ background: '#9ca3af' }} />
      <Handle type="target" position={Position.Right} id="target-right" style={{ background: '#9ca3af' }} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" style={{ background: '#9ca3af' }} />
      <Handle type="target" position={Position.Left} id="target-left" style={{ background: '#9ca3af' }} />
      
      <div className="p-2 bg-blue-50 text-sm font-medium flex justify-between items-center">
        <span>新对话</span>
        <button
          className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
          onClick={() => fileInputRef.current.click()}
        >
          上传 TXT
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".txt"
          onChange={handleFileUpload}
        />
      </div>
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
      
      <Handle type="source" position={Position.Top} id="source-top" style={{ background: '#9ca3af' }} />
      <Handle type="source" position={Position.Right} id="source-right" style={{ background: '#9ca3af' }} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" style={{ background: '#9ca3af' }} />
      <Handle type="source" position={Position.Left} id="source-left" style={{ background: '#9ca3af' }} />
    </div>
  );
}
