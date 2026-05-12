import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import useStore from '../store';
import { sendMessage } from '../api';
import { collectContext, findNearestAgentId, getAncestorPath } from '../utils/graphUtils';

const MAX_NODE_WIDTH = 1200;

const PreWithCopy = ({ children, ...props }) => {
  const preRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e) => {
    e.stopPropagation();          // 阻止事件冒泡到画布
    const codeText = preRef.current?.innerText || '';
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(console.error);
  }, []);

  return (
    <div className="code-block-wrapper">
      <pre ref={preRef} {...props}>{children}</pre>
      <button
        onClick={handleCopy}
        className="code-copy-button"
      >
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  );
};

export default function ConversationNode({ id, data }) {
  const [question, setQuestion] = useState(data.question || '');
  const [isEditing, setIsEditing] = useState(!data.answer);
  const [isSending, setIsSending] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const updateNode = useStore(state => state.updateNode);
  const getCurrentNodes = useStore(state => state.getCurrentNodes);
  const autoNodeEnabled = useStore(state => state.autoNodeEnabled);
  const setFlowPath = useStore(state => state.setFlowPath);
  const clearFlowPath = useStore(state => state.clearFlowPath);
  const flowPathNodes = useStore(state => state.flowPathNodes);
  const { getAutoCount, incrementAutoCount, resetAutoCount } = useStore();

  const nodeWidth = data.width || 800;

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowedExtensions = ['.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.htm', '.css', '.csv', '.xml', '.yaml', '.yml', '.log', '.sh', '.bat', '.ini', '.cfg', '.conf'];
    if (!allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
      alert('仅支持文本文件（如 .txt, .md, .json, .js, .py, .html, .css 等）');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedFile({ name: file.name, content: event.target.result });
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const removeAttachedFile = () => setAttachedFile(null);

  const handleSend = async () => {
    if (!question.trim() && !attachedFile) return;
    if (isSending) return;

    setIsSending(true);
    try {
      const allNodes = getCurrentNodes();
      const node = allNodes.find(n => n.id === id);
      if (!node) return;
      if (!node.parentId) {
        alert('此节点没有父节点，请先连接到 Agent 根节点或其他对话节点。');
        setIsSending(false);
        return;
      }

      // 流光线路径
      const ancestorIds = getAncestorPath(allNodes, id);
      const ancestorEdgeIds = [];
      for (let i = 0; i < ancestorIds.length - 1; i++) {
        ancestorEdgeIds.push(`${ancestorIds[i]}-${ancestorIds[i+1]}`);
      }
      setFlowPath(ancestorIds, ancestorEdgeIds);

      const context = collectContext(allNodes, node.parentId);
      let agentId = node.agentId;
      if (!agentId) {
        const nearest = findNearestAgentId(allNodes, id);
        if (!nearest) {
          alert('该节点未连接到任何 Agent，请先连接至 Agent 根节点');
          setIsSending(false);
          clearFlowPath();
          return;
        }
        agentId = nearest;
        updateNode(id, { agentId });
      }

      let apiQuestion = question;
      if (attachedFile) {
        const fileInfo = `[上传文件：${attachedFile.name}]\n内容：\n${attachedFile.content}\n\n`;
        apiQuestion = question ? fileInfo + question : `请分析以下文件内容：\n${attachedFile.content}`;
      }

      const generateSummary = async (nodeId, question, answer, agentId, allNodes, parentId) => {
        try {
          const summaryPrompt = `请用一两句话总结以下对话内容。只输出总结，不要包含任何其他内容。\n用户问题：${question}\n助手回复：${answer}`;
          const { answer: summaryAnswer } = await sendMessage(
            agentId,
            summaryPrompt,
            [], // 摘要生成不需要额外上下文
            true  // skipAutoAction = true
          );
          updateNode(nodeId, { summary: summaryAnswer });
        } catch (err) {
          console.error('摘要生成失败', err);
          // 静默失败，不打扰用户
        }
      };

      const { answer, autoAction } = await sendMessage(agentId, apiQuestion, context);

      const currentAttachedFiles = node.attachedFiles || [];
      const newAttachedFiles = attachedFile
        ? [...currentAttachedFiles, attachedFile.name]
        : currentAttachedFiles;

      updateNode(id, { question, answer, attachedFiles: newAttachedFiles });

      generateSummary(id, question, answer, agentId, allNodes, node.parentId);

      setIsEditing(false);
      setAttachedFile(null);
      clearFlowPath();

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
      clearFlowPath();
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
    const attachedFiles = data.attachedFiles || [];
    const isCollapsed = data.collapsed || false;

    const handleToggleCollapse = () => {
      const { toggleCollapseNode } = useStore.getState();
      toggleCollapseNode(id);
    };

    return (
      <div
        className={`conversation-node ${data.hidden ? 'node-hidden' : ''} ${data.isAutoCreated ? 'auto-created' : ''} ${flowPathNodes.includes(id) ? 'flow-active' : ''}`}
        style={{ width: nodeWidth, minWidth: 200 }}
      >
        <NodeResizer
          minWidth={200} maxWidth={MAX_NODE_WIDTH}
          onResize={(_, params) => updateNode(id, { width: params.width })}
          lineStyle={{ borderColor: 'transparent' }} handleStyle={{ opacity: 0 }}
        />
        <Handle type="target" position={Position.Top} id="target-top" style={{ background: '#9ca3af' }} />
        <Handle type="target" position={Position.Right} id="target-right" style={{ background: '#9ca3af' }} />
        <Handle type="target" position={Position.Bottom} id="target-bottom" style={{ background: '#9ca3af' }} />
        <Handle type="target" position={Position.Left} id="target-left" style={{ background: '#9ca3af' }} />

        <div className="p-2 border-b bg-gray-50 text-sm font-medium">问题</div>
        <div className={`p-2 text-sm whitespace-pre-wrap ${isCollapsed ? 'collapsed-question' : ''}`}>
          {data.question}
        </div>


        {attachedFiles.length > 0 && (
          <div className="px-2 pb-1">
            <div className="text-xs text-gray-500 mb-1">附件：</div>
            <div className="flex flex-wrap gap-1">
              {attachedFiles.map((name, i) => (
                <span key={i} className="inline-flex items-center bg-gray-100 rounded px-2 py-0.5 text-xs">
                  <span className="mr-1">📄</span>{name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="p-2 border-t bg-gray-50 text-sm font-medium">回复</div>
        <div className={`p-2 text-sm prose max-w-none ${isCollapsed ? 'collapsed-answer' : ''}`}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              pre: PreWithCopy,
            }}
          >
            {data.answer}
          </ReactMarkdown>
        </div>

        {isCollapsed && (
          <div className="px-2 pb-2 text-center">
            <button
              onClick={handleToggleCollapse}
              className="text-xs text-blue-500 hover:underline"
            >
              显示全部
            </button>
          </div>
        )}

        <Handle type="source" position={Position.Top} id="source-top" style={{ background: '#9ca3af' }} />
        <Handle type="source" position={Position.Right} id="source-right" style={{ background: '#9ca3af' }} />
        <Handle type="source" position={Position.Bottom} id="source-bottom" style={{ background: '#9ca3af' }} />
        <Handle type="source" position={Position.Left} id="source-left" style={{ background: '#9ca3af' }} />
      </div>
    );
  }

  // 编辑状态
  return (
    <div className="conversation-node" style={{ width: nodeWidth, minWidth: 200 }}>
      <NodeResizer
        minWidth={200} maxWidth={MAX_NODE_WIDTH}
        onResize={(_, params) => updateNode(id, { width: params.width })}
        lineStyle={{ borderColor: 'transparent' }} handleStyle={{ opacity: 0 }}
      />
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
          accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.py,.html,.htm,.css,.csv,.xml,.yaml,.yml,.log,.sh,.bat,.ini,.cfg,.conf,text/plain"
          onChange={handleFileUpload}
        />
      </div>

      {attachedFile && (
        <div className="px-2 pt-1">
          <div className="flex items-center justify-between bg-gray-100 rounded px-2 py-1 text-xs">
            <span className="truncate flex items-center">
              <span className="mr-1">📄</span>{attachedFile.name}
            </span>
            <button className="ml-2 text-gray-500 hover:text-red-500" onClick={removeAttachedFile}>✕</button>
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
