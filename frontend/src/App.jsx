import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import useStore from './store';
import AgentNode from './components/AgentNode';
import ConversationNode from './components/ConversationNode';
import Toolbar from './components/Toolbar';
import ContextMenu from './components/ContextMenu';
import HistorySidebar from './components/HistorySidebar';
import { wouldCreateCycle } from './utils/graphUtils';
import { getAgents } from './api';
import { v4 as uuidv4 } from 'uuid';

const nodeTypes = {
  agent: AgentNode,
  conversation: ConversationNode,
};

export default function App() {
  const { 
    init, 
    getCurrentNodes, 
    updateCurrentNodes, 
    addNode, 
    updateNode, 
    deleteNode, 
    autoNodeEnabled,
    currentFileId,
  } = useStore();
  const [nodes, setNodesFlow, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [menu, setMenu] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // 初始化 store（创建默认文件）
  useEffect(() => {
    init();
  }, [init]);

  // 获取当前节点（每次渲染重新获取）
  const currentNodes = getCurrentNodes();

  // 同步 currentNodes 到 ReactFlow 并生成边
  useEffect(() => {
    const flowNodes = currentNodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node,
    }));
    setNodesFlow(flowNodes);
    
    const flowEdges = currentNodes
      .filter(node => node.parentId && node.type !== 'agent')
      .map(node => ({
        id: `${node.parentId}-${node.id}`,
        source: node.id,
        target: node.parentId,
        type: 'smoothstep',
        animated: false,
      }));
    setEdges(flowEdges);
  }, [currentNodes, setNodesFlow, setEdges]);

  // 初始化 Agent 根节点（如果当前文件没有根节点）
  useEffect(() => {
    if (!initialized) return;
    const hasAgentRoot = currentNodes.some(n => n.type === 'agent');
    if (!hasAgentRoot) {
      getAgents()
        .then(agentList => {
          if (agentList.length) {
            const startX = 100;
            const startY = 100;
            const gapX = 350;
            const newAgentNodes = agentList.map((agent, index) => ({
              id: agent.id,
              type: 'agent',
              name: agent.name,
              model: agent.model,
              position: { x: startX + index * gapX, y: startY },
            }));
            updateCurrentNodes([...currentNodes, ...newAgentNodes]);
          }
        })
        .catch(err => console.error('Failed to load agents', err));
    }
  }, [initialized, currentNodes, updateCurrentNodes]);

  // 加载 agents 完成标记
  useEffect(() => {
    if (!initialized) {
      getAgents()
        .then(() => setInitialized(true))
        .catch(() => setInitialized(true));
    }
  }, [initialized]);

  // 以下所有 useCallback 依赖 currentNodes 或 updateNode 等，定义在 currentNodes 声明之后
  const onNodeDragStop = useCallback((_, node) => {
    const existing = currentNodes.find(n => n.id === node.id);
    if (existing && (existing.position.x !== node.position.x || existing.position.y !== node.position.y)) {
      updateNode(node.id, { position: node.position });
    }
  }, [currentNodes, updateNode]);

  const onConnect = useCallback((params) => {
    const { source, target } = params;
    const targetNode = currentNodes.find(n => n.id === target);
    if (!targetNode) return;
    
    if (targetNode.type !== 'agent') {
      if (wouldCreateCycle(currentNodes, source, target)) {
        alert('不能形成循环引用');
        return;
      }
    }
    updateNode(source, { parentId: target });
    let newAgentId = null;
    if (targetNode.type === 'agent') {
      newAgentId = target;
    } else {
      newAgentId = targetNode.agentId;
    }
    if (newAgentId) {
      updateNode(source, { agentId: newAgentId });
    }
  }, [currentNodes, updateNode]);

  const onEdgeDoubleClick = useCallback((event, edge) => {
    const childId = edge.source;
    updateNode(childId, { parentId: null });
    alert('连线已删除，该节点及其子节点现在为自由节点，可重新连接');
  }, [updateNode]);

  const handleCopyNode = useCallback(() => {
    if (!menu || !reactFlowInstance) return;
    const nodeId = menu.nodeId;
    const originalNode = currentNodes.find(n => n.id === nodeId);
    if (!originalNode) return;
    if (originalNode.type === 'agent') {
      alert('不能复制 Agent 根节点');
      return;
    }
    const position = reactFlowInstance.screenToFlowPosition({
      x: menu.x,
      y: menu.y,
    });
    const newNodeId = uuidv4();
    const newNode = {
      id: newNodeId,
      type: 'conversation',
      parentId: null,
      agentId: originalNode.agentId,
      question: originalNode.question,
      answer: originalNode.answer,
      hidden: originalNode.hidden,
      isAutoCreated: false,
      position: position,
    };
    addNode(newNode);
    closeMenu();
  }, [menu, currentNodes, addNode, reactFlowInstance]);

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    if (node.type === 'agent') return;
    setMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);

  const closeMenu = () => setMenu(null);
  const handleHide = () => {
    if (menu) {
      updateNode(menu.nodeId, { hidden: true });
      closeMenu();
    }
  };
  const handleShow = () => {
    if (menu) {
      updateNode(menu.nodeId, { hidden: false });
      closeMenu();
    }
  };
  const handleDelete = () => {
    if (menu) {
      deleteNode(menu.nodeId);
      closeMenu();
    }
  };

  const onNodeDoubleClick = useCallback((event, node) => {
    const newId = uuidv4();
    const newPosition = {
      x: node.position.x,
      y: node.position.y + 120,
    };
    let parentId = node.id;
    let agentId = null;
    if (node.type === 'agent') {
      agentId = node.id;
    } else {
      agentId = node.data.agentId;
    }
    const newNode = {
      id: newId,
      type: 'conversation',
      parentId: parentId,
      agentId: agentId,
      question: '',
      answer: '',
      hidden: false,
      isAutoCreated: false,
      position: newPosition,
    };
    addNode(newNode);
  }, [addNode]);

  return (
    <div className="w-full h-screen">
      <Toolbar />
      <HistorySidebar />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.Bezier}
        fitView
      >
        <Background gap={20} size={1} />
        <Controls />
        <MiniMap />
        <Panel position="top-right" className="bg-white p-2 rounded shadow text-xs">
          提示：双击节点创建子对话 | 拖拽连线重设父节点 | 双击连线删除 | 右键节点操作
        </Panel>
      </ReactFlow>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          nodeId={menu.nodeId}
          onClose={closeMenu}
          onHide={handleHide}
          onShow={handleShow}
          onDelete={handleDelete}
          onCopy={handleCopyNode}
        />
      )}
    </div>
  );
}
