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
import { wouldCreateCycle } from './utils/graphUtils';
import { getAgents } from './api';
import { v4 as uuidv4 } from 'uuid';

const nodeTypes = {
  agent: AgentNode,
  conversation: ConversationNode,
};

export default function App() {
  const { nodes: storeNodes, setNodes, addNode, updateNode, deleteNode, autoNodeEnabled } = useStore();
  const [nodes, setNodesFlow, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [menu, setMenu] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // 强制从后端同步 Agent 根节点
  useEffect(() => {
    if (initialized) return;
    getAgents()
      .then(agentList => {
        const existingAgentIds = storeNodes.filter(n => n.type === 'agent').map(n => n.id);
        const newAgentIds = agentList.map(a => a.id);
        const needUpdate = existingAgentIds.length !== newAgentIds.length ||
          !existingAgentIds.every(id => newAgentIds.includes(id));
        
        if (needUpdate) {
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
          setNodes(newAgentNodes);
          if (storeNodes.some(n => n.type !== 'agent')) {
            alert('检测到 Agent 列表已变化，所有历史对话节点已被清除。');
          }
        }
        setInitialized(true);
      })
      .catch(err => {
        console.error('Failed to load agents', err);
        setInitialized(true);
      });
  }, [storeNodes, setNodes, initialized]);

  // 同步 store 中的节点到 ReactFlow 状态，并生成边
  useEffect(() => {
    const flowNodes = storeNodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node,
    }));
    setNodesFlow(flowNodes);
    
    const flowEdges = storeNodes
      .filter(node => node.parentId && node.type !== 'agent')
      .map(node => ({
        id: `${node.parentId}-${node.id}`,
        source: node.id,
        target: node.parentId,
        type: 'smoothstep',
        animated: false,
      }));
    setEdges(flowEdges);
  }, [storeNodes, setNodesFlow, setEdges]);

  const onNodeDragStop = useCallback((_, node) => {
    const existing = storeNodes.find(n => n.id === node.id);
    if (existing && (existing.position.x !== node.position.x || existing.position.y !== node.position.y)) {
      updateNode(node.id, { position: node.position });
    }
  }, [storeNodes, updateNode]);

  // 连接节点（重新指定父节点）
  const onConnect = useCallback((params) => {
    const { source, target } = params;
    // 允许连接到根节点（agent类型）或其他对话节点
    const targetNode = storeNodes.find(n => n.id === target);
    if (!targetNode) return;
    
    // 检查循环：只有目标节点是对话节点时才检查（根节点不会造成循环）
    if (targetNode.type !== 'agent') {
      if (wouldCreateCycle(storeNodes, source, target)) {
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
  }, [storeNodes, updateNode]);

  // 双击连线：删除连线，子节点变为自由节点
  const onEdgeDoubleClick = useCallback((event, edge) => {
    const childId = edge.source;
    updateNode(childId, { parentId: null });
    alert('连线已删除，该节点及其子节点现在为自由节点，可重新连接');
  }, [updateNode]);

  // 复制节点
  const handleCopyNode = useCallback(() => {
    if (!menu || !reactFlowInstance) return;
    const nodeId = menu.nodeId;
    const originalNode = storeNodes.find(n => n.id === nodeId);
    if (!originalNode) return;
    if (originalNode.type === 'agent') {
      alert('不能复制 Agent 根节点');
      return;
    }
    // 获取当前鼠标位置（相对于画布）
    const position = reactFlowInstance.screenToFlowPosition({
      x: menu.x,
      y: menu.y,
    });
    const newNodeId = uuidv4();
    const newNode = {
      id: newNodeId,
      type: 'conversation',
      parentId: null,           // 自由节点
      agentId: originalNode.agentId,
      question: originalNode.question,
      answer: '',               // 清空回答，用户可重新发送
      hidden: originalNode.hidden,
      isAutoCreated: false,
      position: position,
    };
    addNode(newNode);
    closeMenu();
  }, [menu, storeNodes, addNode, reactFlowInstance]);

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
