// 收集上下文（从父节点向上，跳过隐藏节点）
export function collectContext(nodes, startNodeId) {
  const history = [];
  let currentId = startNodeId;
  while (currentId) {
    const node = nodes.find(n => n.id === currentId);
    if (!node) break;
    if (!node.hidden && node.answer && node.question) {
      history.unshift({ question: node.question, answer: node.answer });
    }
    currentId = node.parentId;
  }
  return history;
}

// 检查是否会形成循环（newParent是否是child的后代）
export function wouldCreateCycle(nodes, childId, newParentId) {
  if (childId === newParentId) return true;
  let current = newParentId;
  while (current) {
    if (current === childId) return true;
    const node = nodes.find(n => n.id === current);
    if (!node) break;
    current = node.parentId;
  }
  return false;
}

// 从节点向上找到最近的Agent根节点ID
export function findNearestAgentId(nodes, nodeId) {
  let currentId = nodeId;
  while (currentId) {
    const node = nodes.find(n => n.id === currentId);
    if (node.type === 'agent') return node.id;
    currentId = node.parentId;
  }
  return null;
}
