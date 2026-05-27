import React, { useCallback, useEffect, useState, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  Panel,
  addEdge,
  MarkerType,
  useOnViewportChange,
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

const DIRECTION_HANDLE_MAP = {
  top:    { source: 'source-bottom', target: 'target-top' },
  bottom: { source: 'source-top',    target: 'target-bottom' },
  left:   { source: 'source-right',  target: 'target-left' },
  right:  { source: 'source-left',   target: 'target-right' },
};

function ViewportListener() {
  const setViewportZoom = useStore(state => state.setViewportZoom);
  useOnViewportChange({
    onChange: useCallback((viewport) => {
      setViewportZoom(viewport.zoom);
    }, [setViewportZoom]),
    onMoveEnd: useCallback((viewport) => {
      setViewportZoom(viewport.zoom);
    }, [setViewportZoom]),
  });
  return null;
}

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
    flowPathNodes,
    flowPathEdges,
    clearFlowPath,
    hasHydrated,
  } = useStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [menu, setMenu] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [initialized, setInitialized] = useState(false);

  const currentNodes = getCurrentNodes();
  const viewportZoom = useStore(state => state.viewportZoom);

  // 动态连线粗细函数（必须放在组件内部）
  const BASE_STROKE = 2.0;
  const MIN_STROKE = 1.0;
  const BOLD_FACTOR_STROKE = 0;   // 极高加粗系数

  function getStrokeWidth(zoom) {
    if (!zoom || zoom >= 1) return BASE_STROKE;
    const factor = 1 + BOLD_FACTOR_STROKE * (1 - zoom);
    return Math.max(MIN_STROKE, (BASE_STROKE * factor) / zoom);
  }

  // hydrate 后初始化
  useEffect(() => {
    if (hasHydrated) {
      init();
      setInitialized(true);
    }
  }, [hasHydrated]);

  // 同步节点
  useEffect(() => {
    const flowNodes = currentNodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node,
    }));
    setNodes(flowNodes);
  }, [currentNodes, setNodes]);

  // 同步边 + 动态样式
  useEffect(() => {
    const zoom = viewportZoom || 1;
    const strokeWidth = getStrokeWidth(zoom);
    const strokeColor = zoom < 0.5 ? '#000' : '#374151';

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
            markerEnd: { type: MarkerType.ArrowClosed },
            data: { isFlowActive: false },
            sourceHandle: node.sourceHandle || null,
            targetHandle: node.targetHandle || null,
          });
        }
      });

      const newEdges = [];
      const existingEdgesMap = new Map(prevEdges.map(e => [`${e.source}->${e.target}`, e]));

      for (const [key, expectedEdge] of expectedEdgesMap.entries()) {
        const existing = existingEdgesMap.get(key);
        const isFlow = flowPathEdges.includes(expectedEdge.id);
        const edgeStyle = isFlow 
          ? { strokeWidth, stroke: '#facc15' }   // 流光线金色
          : { strokeWidth, stroke: strokeColor }; // 普通边动态颜色
      
        newEdges.push({
          ...expectedEdge,
          sourceHandle: expectedEdge.sourceHandle || existing?.sourceHandle || null,
          targetHandle: expectedEdge.targetHandle || existing?.targetHandle || null,
          className: isFlow ? 'flow-active' : '',
          style: edgeStyle,
          data: { isFlowActive: isFlow },
        });
      }

      return newEdges;
    });
  }, [currentNodes, flowPathEdges, setEdges, viewportZoom]);

  // Agent 根节点初始化
  const agentInitDone = useRef(false);
  
  useEffect(() => {
    if (!initialized || !hasHydrated || agentInitDone.current) return;
  
    getAgents()
      .then(agentList => {
        if (agentList.length === 0) return;
  
        const currentNodes = getCurrentNodes();
        const startX = 100, startY = 100, gapX = 350;
        const newAgentNodes = agentList.map((agent, index) => ({
          id: agent.id,
          type: 'agent',
          name: agent.name,
          model: agent.model,
          initialContent: agent.initialContent || '',
          position: { x: startX + index * gapX, y: startY },
        }));

        const hasAgentRoot = currentNodes.some(n => n.type === 'agent');
        let updatedNodes;
        if (!hasAgentRoot) {
          updatedNodes = [...currentNodes, ...newAgentNodes];
        } else {
          updatedNodes = currentNodes.map(node => {
            if (node.type !== 'agent') return node;
            const updatedAgent = newAgentNodes.find(a => a.id === node.id);
            if (updatedAgent) {
              return { ...node, initialContent: updatedAgent.initialContent };
            }
            return node;
          });
          newAgentNodes.forEach(newAgent => {
            if (!updatedNodes.some(n => n.id === newAgent.id)) {
              updatedNodes.push(newAgent);
            }
          });
        }
        updateCurrentNodes(updatedNodes);
        agentInitDone.current = true;
      })
      .catch(err => console.error('Failed to load agents', err));
  }, [initialized, hasHydrated]); // 仅依赖 initialized 和 hasHydrated

  // 自动创建监听
  useEffect(() => {
    const handleAutoCreate = (event) => {
      const { parentId, agentName, question } = event.detail;
      if (!autoNodeEnabled) return;
      const agentNode = currentNodes.find(n => n.type === 'agent' && n.name === agentName);
      if (!agentNode) return;
      const parentNode = currentNodes.find(n => n.id === parentId);
      if (!parentNode) return;
      const newPosition = { x: parentNode.position.x, y: parentNode.position.y + 150 };
      const newNode = {
        id: uuidv4(), type: 'conversation', parentId, agentId: agentNode.id,
        question, answer: '', hidden: false, isAutoCreated: true, position: newPosition,
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

    updateNode(source, {
      parentId: target,
      sourceHandle,
      targetHandle,
    });

    setEdges(eds => addEdge({
      id: `${source}-${target}`,
      source,
      target,
      sourceHandle,
      targetHandle,
      type: 'smoothstep',
      animated: sourceNode.isAutoCreated || false,
      markerEnd: { type: MarkerType.ArrowClosed },
    }, eds));

    let newAgentId = targetNode.type === 'agent' ? targetNode.id : targetNode.agentId;
    if (newAgentId) updateNode(source, { agentId: newAgentId });
  }, [currentNodes, updateNode, setEdges]);

  const onEdgeDoubleClick = useCallback((event, edge) => {
    const childId = edge.source;
    updateNode(childId, {
      parentId: null,
      sourceHandle: null,
      targetHandle: null,
    });
    setEdges(eds => eds.filter(e => e.id !== edge.id));
    alert('连线已删除，该节点现在为自由节点，可重新连接');
  }, [updateNode, setEdges]);

  const closeMenu = () => setMenu(null);

  const handleHide = () => {
    if (menu) { updateNode(menu.nodeId, { hidden: true }); closeMenu(); }
  };
  const handleShow = () => {
    if (menu) { updateNode(menu.nodeId, { hidden: false }); closeMenu(); }
  };
  const handleDelete = () => {
    if (!menu) return;
    const nodeId = menu.nodeId;
    const node = currentNodes.find(n => n.id === nodeId);
    if (!node || node.type === 'agent') { alert('不能删除 Agent 根节点'); closeMenu(); return; }
    if (!window.confirm('删除节点后，其子节点将自动连接到上级节点。确定删除吗？')) { closeMenu(); return; }
    deleteNode(nodeId);
    closeMenu();
  };

  const handleCopyNode = useCallback(() => {
    if (!menu || !reactFlowInstance) return;
    const nodeId = menu.nodeId;
    const originalNode = currentNodes.find(n => n.id === nodeId);
    if (!originalNode || originalNode.type === 'agent') {
      alert('不能复制 Agent 根节点');
      return;
    }
    const position = reactFlowInstance.screenToFlowPosition({
      x: menu.x,
      y: menu.y,
    });
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
      summary: originalNode.summary,
      attachedFiles: originalNode.attachedFiles || [],
      width: originalNode.width || 280,
    };
    addNode(newNode);
    closeMenu();
  }, [menu, currentNodes, addNode, reactFlowInstance]);

  const handleCopyContent = useCallback(async () => {
    if (!menu) return;
    const node = currentNodes.find(n => n.id === menu.nodeId);
    if (!node) return;
  
    const parts = [];
    if (node.question) {
      parts.push(`问题：\n${node.question}`);
    }
    if (node.answer) {
      parts.push(`回复：\n${node.answer}`);
    }
    const text = parts.join('\n\n');
  
    try {
      await navigator.clipboard.writeText(text);
      closeMenu();
    } catch (err) {
      console.error('复制失败:', err);
      alert('复制失败，请检查浏览器剪贴板权限');
    }
  }, [menu, currentNodes]);

  const handleViewSummary = useCallback(() => {
    if (!menu) return;
    const node = currentNodes.find(n => n.id === menu.nodeId);
    if (!node || !node.summary) {
      alert('该节点暂无摘要');
      return;
    }
    alert(`摘要：\n${node.summary}`);
    closeMenu();
  }, [menu, currentNodes]);

  const handleCollapseToggle = useCallback(() => {
    if (!menu) return;
    const { toggleCollapseNode } = useStore.getState();
    toggleCollapseNode(menu.nodeId);
    closeMenu();
  }, [menu]);

  const handleAlignToParent = useCallback(() => {
    if (!menu || !reactFlowInstance) return;
    const nodeId = menu.nodeId;
    const childNodeData = currentNodes.find(n => n.id === nodeId);
    if (!childNodeData || !childNodeData.parentId) return;
  
    const parentId = childNodeData.parentId;
    const childRFNode = reactFlowInstance.getNode(nodeId);
    const parentRFNode = reactFlowInstance.getNode(parentId);
    if (!childRFNode || !parentRFNode) return;
  
    // 直接使用 React Flow 的实时尺寸，因为 outline 不影响盒模型
    const childWidth = childRFNode.width ?? (childNodeData.width || 800);
    const parentWidth = parentRFNode.width ?? 120;
    const childHeight = childRFNode.height ?? 100;
    const parentHeight = parentRFNode.height ?? 60;
  
    const sourceHandle = childNodeData.sourceHandle || 'source-top';
    const targetHandle = childNodeData.targetHandle || 'target-bottom';
  
    const parentCenterX = parentRFNode.position.x + parentWidth / 2;
    const parentCenterY = parentRFNode.position.y + parentHeight / 2;
  
    let newX = childNodeData.position.x;
    let newY = childNodeData.position.y;
  
    const isSourceTop = sourceHandle.includes('top');
    const isSourceBottom = sourceHandle.includes('bottom');
    const isSourceLeft = sourceHandle.includes('left');
    const isSourceRight = sourceHandle.includes('right');
  
    if (isSourceTop || isSourceBottom) {
      newX = parentCenterX - childWidth / 2;
    } else if (isSourceLeft || isSourceRight) {
      newY = parentCenterY - childHeight / 2;
    }
  
    updateNode(nodeId, { position: { x: newX, y: newY } });
    closeMenu();
  }, [menu, currentNodes, reactFlowInstance, updateNode]);

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
      case 'top': newPosition.y -= offset; break;
      case 'bottom': newPosition.y += offset; break;
      case 'left': newPosition.x -= offset; break;
      case 'right': newPosition.x += offset; break;
      default: newPosition.y += offset;
    }
    const newNodeId = uuidv4();
    const { source: sHandle, target: tHandle } = DIRECTION_HANDLE_MAP[direction] || DIRECTION_HANDLE_MAP.bottom;
    const newNode = {
      id: newNodeId, type: 'conversation', parentId,
      agentId: parentNode.type === 'agent' ? parentNode.id : parentNode.agentId,
      question: '', answer: '', hidden: false, isAutoCreated: false,
      position: newPosition,
      sourceHandle: sHandle,
      targetHandle: tHandle,
    };
    addNode(newNode);
    setEdges(eds => addEdge({
      id: `${newNodeId}-${parentId}`,
      source: newNodeId,
      target: parentId,
      sourceHandle: sHandle,
      targetHandle: tHandle,
      type: 'smoothstep',
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed },
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
      id: newId, type: 'conversation', parentId: node.id,
      agentId: node.type === 'agent' ? node.id : node.data.agentId,
      question: '', answer: '', hidden: false, isAutoCreated: false,
      position: newPosition,
      sourceHandle: 'source-top',
      targetHandle: 'target-bottom',
    };
    addNode(newNode);
    setEdges(eds => addEdge({
      id: `${newId}-${node.id}`,
      source: newId,
      target: node.id,
      sourceHandle: 'source-top',
      targetHandle: 'target-bottom',
      type: 'smoothstep',
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed },
    }, eds));
  }, [addNode, setEdges]);

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    if (node.type === 'agent') return;
    setMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);

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
        minZoom={0.05}
        fitView
        isValidConnection={(connection) => {
          const sourceNode = currentNodes.find(n => n.id === connection.source);
          return sourceNode?.type !== 'agent';
        }}
      >
        <ViewportListener />
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
          onCopyContent={handleCopyContent}
          onCollapseToggle={handleCollapseToggle}
          isCollapsed={currentNodes.find(n => n.id === menu.nodeId)?.collapsed || false}
          onAlignToParent={handleAlignToParent}
          hasParent={!!currentNodes.find(n => n.id === menu.nodeId)?.parentId}
          onViewSummary={handleViewSummary}
          hasSummary={!!(currentNodes.find(n => n.id === menu.nodeId)?.summary)}
        />
      )}
    </div>
  );
}
