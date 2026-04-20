import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  Panel,
  addEdge,
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

// 方向 → 子节点 sourceHandle / 父节点 targetHandle 映射
const DIRECTION_HANDLE_MAP = {
  top:    { source: 'source-bottom', target: 'target-top' },
  bottom: { source: 'source-top',    target: 'target-bottom' },
  left:   { source: 'source-right',  target: 'target-left' },
  right:  { source: 'source-left',   target: 'target-right' },
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
    addAutoNode,
  } = useStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [menu, setMenu] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [initialized, setInitialized] = useState(false);

  const currentNodes = getCurrentNodes();

  useEffect(() => {
    const flowNodes = currentNodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node,
    }));
    setNodes(flowNodes);
  }, [currentNodes, setNodes]);

  useEffect(() => {
    setEdges(prevEdges => {
      const expectedEdgesMap = new Map();
      currentNodes.forEach(node => {
        if (node.parentId && node.type !== 'agent') {
          const edgeKey = `${node.id}->${node.parentId}`;
          expectedEdgesMap.set(edgeKey, {
            id: `${node.id}-${node.parentId}`,
            source: node.id,
            target: node.parentId,
            type: 'smoothstep',
            animated: node.isAutoCreated || false,
          });
        }
      });

      const newEdges = [];
      const existingEdgesMap = new Map(prevEdges.map(e => [`${e.source}->${e.target}`, e]));

      for (const [key, expectedEdge] of expectedEdgesMap.entries()) {
        const existing = existingEdgesMap.get(key);
        newEdges.push({
          ...expectedEdge,
          sourceHandle: existing?.sourceHandle || null,
          targetHandle: existing?.targetHandle || null,
        });
      }

      return newEdges;
    });
  }, [currentNodes, setEdges]);

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

  useEffect(() => {
    if (!initialized) {
      getAgents()
        .then(() => setInitialized(true))
        .catch(() => setInitialized(true));
    }
  }, [initialized]);

  useEffect(() => {
    const handleAutoCreate = (event) => {
      const { parentId, agentName, question } = event.detail;
      if (!autoNodeEnabled) return;

      const agentNode = currentNodes.find(n => n.type === 'agent' && n.name === agentName);
      if (!agentNode) return;

      const parentNode = currentNodes.find(n => n.id === parentId);
      if (!parentNode) return;

      const newPosition = {
        x: parentNode.position.x,
        y: parentNode.position.y + 150,
      };

      const newNode = {
        id: uuidv4(),
        type: 'conversation',
        parentId: parentId,
        agentId: agentNode.id,
        question: question,
        answer: '',
        hidden: false,
        isAutoCreated: true,
        position: newPosition,
      };

      addAutoNode(newNode, parentId);
    };

    window.addEventListener('auto-create-node', handleAutoCreate);
    return () => window.removeEventListener('auto-create-node', handleAutoCreate);
  }, [currentNodes, autoNodeEnabled, addAutoNode]);

  const onNodeDragStop = useCallback((_, node) => {
    const existing = currentNodes.find(n => n.id === node.id);
    if (existing && (existing.position.x !== node.position.x || existing.position.y !== node.position.y)) {
      updateNode(node.id, { position: node.position });
    }
  }, [currentNodes, updateNode]);

  const onConnect = useCallback((params) => {
    const { source, target, sourceHandle, targetHandle } = params;
    const sourceNode = currentNodes.find(n => n.id === source);
    const targetNode = currentNodes.find(n => n.id === target);

    if (!sourceNode || !targetNode) return;

    if (sourceNode.type === 'agent') {
      alert('连线方向错误：请从子节点拖向父节点');
      return;
    }

    if (wouldCreateCycle(currentNodes, source, target)) {
      alert('不能将节点连接到其后代，这会形成循环。');
      return;
    }

    updateNode(source, { parentId: target });

    setEdges(eds => addEdge({
      ...params,
      id: `${source}-${target}`,
      type: 'smoothstep',
      animated: sourceNode.isAutoCreated || false,
    }, eds));

    let newAgentId = targetNode.type === 'agent' ? targetNode.id : targetNode.agentId;
    if (newAgentId) {
      updateNode(source, { agentId: newAgentId });
    }
  }, [currentNodes, updateNode, setEdges]);

  const onEdgeDoubleClick = useCallback((event, edge) => {
    updateNode(edge.source, { parentId: null });
    setEdges(eds => eds.filter(e => e.id !== edge.id));
    alert('连线已删除，该节点现在为自由节点，可重新连接');
  }, [updateNode, setEdges]);

  const handleCopyNode = useCallback(() => {
    if (!menu || !reactFlowInstance) return;
    const nodeId = menu.nodeId;
    const originalNode = currentNodes.find(n => n.id === nodeId);
    if (!originalNode || originalNode.type === 'agent') {
      alert('不能复制 Agent 根节点');
      return;
    }
    const position = reactFlowInstance.screenToFlowPosition({ x: menu.x, y: menu.y });
    const newNode = {
      id: uuidv4(),
      type: 'conversation',
      parentId: null,
      agentId: originalNode.agentId,
      question: originalNode.question,
      answer: originalNode.answer,
      hidden: originalNode.hidden,
      isAutoCreated: false,
      position,
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
    if (!menu) return;
    const nodeId = menu.nodeId;
    const node = currentNodes.find(n => n.id === nodeId);
    if (!node || node.type === 'agent') {
      alert('不能删除 Agent 根节点');
      closeMenu();
      return;
    }

    if (!window.confirm('删除节点后，其子节点将自动连接到上级节点。确定删除吗？')) {
      closeMenu();
      return;
    }

    deleteNode(nodeId);
    closeMenu();
  };

  const handleCreateChild = useCallback((direction) => {
    if (!menu) return;
    const parentId = menu.nodeId;
    const parentNode = currentNodes.find(n => n.id === parentId);
    if (!parentNode) return;

    if (parentNode.type === 'conversation' && !parentNode.answer) {
      alert('不能从未回复的节点创建子节点');
      return;
    }

    let newPosition = { ...parentNode.position };
    const offset = 220;
    switch (direction) {
      case 'top':    newPosition.y -= offset; break;
      case 'bottom': newPosition.y += offset; break;
      case 'left':   newPosition.x -= offset; break;
      case 'right':  newPosition.x += offset; break;
      default:       newPosition.y += offset;
    }

    const newNodeId = uuidv4();
    const newNode = {
      id: newNodeId,
      type: 'conversation',
      parentId,
      agentId: parentNode.type === 'agent' ? parentNode.id : parentNode.agentId,
      question: '',
      answer: '',
      hidden: false,
      isAutoCreated: false,
      position: newPosition,
    };

    addNode(newNode);

    // 根据方向建立连线（使用修正后的映射）
    const { source, target } = DIRECTION_HANDLE_MAP[direction] || DIRECTION_HANDLE_MAP.bottom;
    setEdges(eds => addEdge({
      id: `${newNodeId}-${parentId}`,
      source: newNodeId,
      target: parentId,
      sourceHandle: source,
      targetHandle: target,
      type: 'smoothstep',
      animated: false,
    }, eds));

    closeMenu();
  }, [menu, currentNodes, addNode, setEdges]);

  const onNodeDoubleClick = useCallback((event, node) => {
    if (node.type === 'conversation' && !node.data.answer) {
      alert('不能从未回复的节点创建子节点');
      return;
    }

    const newId = uuidv4();
    const newPosition = { x: node.position.x, y: node.position.y + 220 };
    const newNode = {
      id: newId,
      type: 'conversation',
      parentId: node.id,
      agentId: node.type === 'agent' ? node.id : node.data.agentId,
      question: '',
      answer: '',
      hidden: false,
      isAutoCreated: false,
      position: newPosition,
    };
    addNode(newNode);

    // 默认在下方创建，连线：子节点 top → 父节点 bottom
    setEdges(eds => addEdge({
      id: `${newId}-${node.id}`,
      source: newId,
      target: node.id,
      sourceHandle: 'source-top',
      targetHandle: 'target-bottom',
      type: 'smoothstep',
      animated: false,
    }, eds));
  }, [addNode, setEdges]);

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
        isValidConnection={(connection) => {
          const sourceNode = currentNodes.find(n => n.id === connection.source);
          return sourceNode?.type !== 'agent';
        }}
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
          onCreateChild={handleCreateChild}
          isHidden={currentNodes.find(n => n.id === menu.nodeId)?.hidden || false}
        />
      )}
    </div>
  );
}
