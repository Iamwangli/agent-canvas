// frontend/src/components/ConversationNode.jsx
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
  const [attachedFile, setAttachedFile] = useState(null); // { name, content }
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
      alert('仅支持 .txt 文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedFile({
        name: file.name,
        content: event.target.result,
      });
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = ''; // 允许重复上传
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
  };

  const handleSend = async () => {
    // 允许只上传文件不输入问题
    if (!question.trim() && !attachedFile) return;
    if (isSending) return;

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

      // 构造最终问题：如果有文件，将内容附在问题后
      let finalQuestion = question;
      if (attachedFile) {
        const fileInfo = `\n\n[上传文件：${attachedFile.name}]\n内容：\n${attachedFile.content}`;
        finalQuestion = question ? question + fileInfo : `请分析以下文件内容：\n${attachedFile.content}`;
      }

      const { answer, autoAction } = await sendMessage(agentId, finalQuestion, context);
      updateNode(id, { question: finalQuestion, answer });
      setIsEditing(false);
      setAttachedFile(null); // 清空文件

      // 自动节点逻辑保持不变
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

  // 只读状态
  if (data.answer) {
    return (
      <div className={`conversation-node ${data.hidden ? 'node-hidden' : ''} ${data.isAutoCreated ? 'auto-created' : ''}`}>
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

        <Handle type="source" position={Position.Top} id="source-top" style={{ background: '#9ca3af' }} />
        <Handle type="source" position={Position.Right} id="source-right" style={{ background: '#9ca3af' }} />
        <Handle type="source" position={Position.Bottom} id="source-bottom" style={{ background: '#9ca3af' }} />
        <Handle type="source" position={Position.Left} id="source-left" style={{ background: '#9ca3af' }} />
      </div>
    );
  }

  // 编辑状态
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
          📎 上传
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".txt"
          onChange={handleFileUpload}
        />
      </div>

      {/* 显示已上传文件 */}
      {attachedFile && (
        <div className="px-2 pt-1">
          <div className="flex items-center justify-between bg-gray-100 rounded px-2 py-1 text-xs">
            <span className="truncate flex items-center">
              <span className="mr-1">📄</span>
              {attachedFile.name}
            </span>
            <button
              className="ml-2 text-gray-500 hover:text-red-500"
              onClick={removeAttachedFile}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <textarea
        ref={inputRef}
        className="w-full p-2 text-sm border-0 focus:ring-0 resize-none"
        rows={3}
        placeholder={attachedFile ? "输入问题（可选）..." : "输入您的问题..."}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSending}
      />
      <button
        className="m-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-400"
        onClick={handleSend}
        disabled={isSending || (!question.trim() && !attachedFile)}
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
