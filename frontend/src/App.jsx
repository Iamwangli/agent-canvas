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
    addAutoNode,
  } = useStore();
  const [nodes, setNodesFlow, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [menu, setMenu] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // 初始化 store
  useEffect(() => {
    init();
  }, [init]);

  const currentNodes = getCurrentNodes();

  // 同步 currentNodes 到 ReactFlow
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
        id: `${node.id}-${node.parentId}`,
        source: node.id,
        target: node.parentId,
        type: 'smoothstep',
        animated: node.isAutoCreated,
      }));
    setEdges(flowEdges);
  }, [currentNodes, setNodesFlow, setEdges]);

  // 初始化 Agent 根节点
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

  // 监听自动创建节点事件
  useEffect(() => {
    const handleAutoCreate = (event) => {
      const { parentId, agentName, question } = event.detail;
      if (!autoNodeEnabled) return;
      
      // 查找目标 Agent 的 ID
      const agentNode = currentNodes.find(n => n.type === 'agent' && n.name === agentName);
      if (!agentNode) {
        console.warn(`Agent "${agentName}" not found`);
        return;
      }
      
      const parentNode = currentNodes.find(n => n.id === parentId);
      if (!parentNode) return;
      
      // 计算新节点位置（默认放在父节点下方）
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
    
    // 方向校验：source 必须是子节点（conversation），target 可以是任何节点
    const sourceNode = currentNodes.find(n => n.id === source);
    const targetNode = currentNodes.find(n => n.id === target);
    
    if (!sourceNode || !targetNode) return;
    
    // 禁止 Agent 作为 source（父不能连向子）
    if (sourceNode.type === 'agent') {
      alert('连线方向错误：请从子节点拖向父节点');
      return;
    }
    
    // 禁止循环
    if (wouldCreateCycle(currentNodes, source, target)) {
      alert('不能将节点连接到其后代，这会形成循环。');
      return;
    }
    
    // 更新父节点
    updateNode(source, { parentId: target });
    
    // 更新 agentId
    let newAgentId = null;
    if (targetNode.type === 'agent') {
      newAgentId = targetNode.id;
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
    alert('连线已删除，该节点现在为自由节点，可重新连接');
  }, [updateNode]);

  // 复制节点
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

  // 右键菜单
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    if (node.type === 'agent') return; // Agent 不显示右键菜单
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
    if (!node) return;
    if (node.type === 'agent') {
      alert('不能删除 Agent 根节点');
      closeMenu();
      return;
    }
    
    const confirmMsg = `删除节点后，其子节点将自动连接到上级节点。确定删除吗？`;
    if (!window.confirm(confirmMsg)) {
      closeMenu();
      return;
    }
    
    deleteNode(nodeId);
    closeMenu();
  };

  // 创建子节点（方向）
  const handleCreateChild = useCallback((direction) => {
    if (!menu) return;
    const parentId = menu.nodeId;
    const parentNode = currentNodes.find(n => n.id === parentId);
    if (!parentNode) return;
    
    // 检查父节点是否已回复（conversation 节点需有 answer，agent 节点直接允许）
    if (parentNode.type === 'conversation' && !parentNode.answer) {
      alert('不能从未回复的节点创建子节点');
      return;
    }
    
    // 计算新节点位置
    let newPosition = { ...parentNode.position };
    const offset = 200;
    switch (direction) {
      case 'top':
        newPosition.y -= offset;
        break;
      case 'right':
        newPosition.x += offset;
        break;
      case 'bottom':
        newPosition.y += offset;
        break;
      case 'left':
        newPosition.x -= offset;
        break;
      default:
        newPosition.y += offset;
    }
    
    const newNodeId = uuidv4();
    let agentId = null;
    if (parentNode.type === 'agent') {
      agentId = parentNode.id;
    } else {
      agentId = parentNode.agentId;
    }
    
    const newNode = {
      id: newNodeId,
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
    closeMenu();
  }, [menu, currentNodes, addNode]);

  const onNodeDoubleClick = useCallback((event, node) => {
    // 检查是否允许创建子节点（对于 conversation，需要已回复）
    if (node.type === 'conversation' && !node.data.answer) {
      alert('不能从未回复的节点创建子节点');
      return;
    }
    
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
        isValidConnection={(connection) => {
          // 额外的前置校验：禁止从 agent 作为 source
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
        />
      )}
    </div>
  );
}
