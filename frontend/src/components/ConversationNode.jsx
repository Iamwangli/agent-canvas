import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import useStore from '../store';
import { sendMessage } from '../api';
import { collectContext, findNearestAgentId, getAncestorPath } from '../utils/graphUtils';

const MAX_NODE_WIDTH = 1200;

const PreWithCopy = ({ children, ...props }) => {
  const preRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e) => {
    e.stopPropagation();
    const codeText = preRef.current?.innerText || '';
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(console.error);
  }, []);

  return (
    <div className="code-block-wrapper">
      <pre ref={preRef} {...props}>{children}</pre>
      <button onClick={handleCopy} className="code-copy-button">
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  );
};

const preprocessLatex = (text) => {
  if (!text) return text;
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
};

export default function ConversationNode({ id, data }) {
  const [question, setQuestion] = useState(data.question || '');
  const [isEditing, setIsEditing] = useState(!data.answer);
  const [isSending, setIsSending] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]); // 改为数组
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

  // 处理多文件上传
  const handleFilesUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const allowedExtensions = ['.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.htm', '.css', '.csv', '.xml', '.yaml', '.yml', '.log', '.sh', '.bat', '.ini', '.cfg', '.conf'];
    const invalidFiles = files.filter(f => !allowedExtensions.some(ext => f.name.toLowerCase().endsWith(ext)));
    if (invalidFiles.length > 0) {
      alert('以下文件不是支持的文本格式：\n' + invalidFiles.map(f => f.name).join('\n'));
      return;
    }

    // 读取每个文件
    const newFiles = [];
    let readCount = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        newFiles.push({ name: file.name, content: event.target.result });
        readCount++;
        if (readCount === files.length) {
          // 全部读取完成后更新状态（追加到已有文件）
          setAttachedFiles(prev => [...prev, ...newFiles]);
        }
      };
      reader.readAsText(file, 'UTF-8');
    });
    e.target.value = ''; // 允许再次选择相同文件
  };

  const removeAttachedFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!question.trim() && attachedFiles.length === 0) return;
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

      // 将当前附件内容拼接（发送时保持文件在前）
      let apiQuestion = question;
      if (attachedFiles.length > 0) {
        const fileContents = attachedFiles.map(f => `[${f.name}]\n${f.content}`).join('\n\n');
        apiQuestion = question ? fileContents + '\n\n' + question : `请分析以下文件内容：\n${fileContents}`;
      }

      const { answer, autoAction } = await sendMessage(agentId, apiQuestion, context);

      // 将已有的附件（可能是之前留下的）与新附件合并
      const existingAttachedFiles = node.attachedFiles || [];
      // 兼容旧数据：如果元素是字符串，视为只有名称没有内容，我们保留它但不包含内容
      const normalizedExisting = existingAttachedFiles.map(item => {
        if (typeof item === 'string') return { name: item, content: '' };
        return item;
      });
      // 合并去重（根据名称）
      const merged = [...normalizedExisting];
      attachedFiles.forEach(newFile => {
        if (!merged.some(f => f.name === newFile.name)) {
          merged.push(newFile);
        }
      });

      updateNode(id, { question, answer, attachedFiles: merged });

      // 摘要生成保持不变
      generateSummary(id, question, answer, agentId);

      setIsEditing(false);
      setAttachedFiles([]); // 清空当前待发送列表
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

  const generateSummary = async (nodeId, question, answer, agentId) => {
    try {
      const summaryPrompt = `请用一两句话总结以下对话内容。只输出总结，不要包含任何其他内容。\n用户问题：${question}\n助手回复：${answer}`;
      const { answer: summaryAnswer } = await sendMessage(agentId, summaryPrompt, [], true);
      updateNode(nodeId, { summary: summaryAnswer });
    } catch (err) {
      console.error('摘要生成失败', err);
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
              {attachedFiles.map((file, i) => (
                <span key={i} className="inline-flex items-center bg-gray-100 rounded px-2 py-0.5 text-xs">
                  <span className="mr-1">📄</span>
                  {typeof file === 'string' ? file : file.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="p-2 border-t bg-gray-50 text-sm font-medium">回复</div>
        <div className={`p-2 text-sm prose max-w-none ${isCollapsed ? 'collapsed-answer' : ''}`}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeKatex]}
            components={{ pre: PreWithCopy }}
          >
            {preprocessLatex(data.answer)}
          </ReactMarkdown>
        </div>

        {isCollapsed && (
          <div className="px-2 pb-2 text-center">
            <button onClick={handleToggleCollapse} className="text-xs text-blue-500 hover:underline">
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
          multiple
          accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.py,.html,.htm,.css,.csv,.xml,.yaml,.yml,.log,.sh,.bat,.ini,.cfg,.conf,text/plain"
          onChange={handleFilesUpload}
        />
      </div>

      {attachedFiles.length > 0 && (
        <div className="px-2 pt-1">
          <div className="flex flex-wrap gap-1">
            {attachedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center bg-gray-100 rounded px-2 py-0.5 text-xs">
                <span className="mr-1">📄</span>
                <span className="truncate max-w-[100px]">{file.name}</span>
                <button
                  className="ml-1 text-gray-500 hover:text-red-500"
                  onClick={() => removeAttachedFile(idx)}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <textarea
        ref={inputRef}
        className="w-full p-2 text-sm border-0 focus:ring-0 resize-none"
        rows={3}
        placeholder={attachedFiles.length > 0 ? "输入问题（可选）..." : "输入您的问题..."}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSending}
      />
      <button
        className="m-2 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-400"
        onClick={handleSend}
        disabled={isSending || (!question.trim() && attachedFiles.length === 0)}
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
