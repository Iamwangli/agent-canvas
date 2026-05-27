// 收集上下文（从父节点向上，跳过隐藏节点）
export function collectContext(nodes, startNodeId) {
  const history = [];
  let currentId = startNodeId;
  let agentNode = null;

  while (currentId) {
    const node = nodes.find(n => n.id === currentId);
    if (!node) break;

    if (node.type === 'agent') {
      agentNode = node;   // 找到根节点后退出循环
      break;
    }

    if (!node.hidden && node.answer && node.question) {
      let enrichedQuestion = node.question;
      const attachedFiles = node.attachedFiles || [];
      const filesWithContent = attachedFiles
        .filter(f => typeof f === 'object' && f.content)
        .map(f => `[${f.name}]\n${f.content}`)
        .join('\n\n');
      if (filesWithContent) {
        enrichedQuestion = filesWithContent + '\n\n' + enrichedQuestion;
      }
      history.unshift({
        question: enrichedQuestion,
        answer: node.answer,
        summary: node.summary || null,
      });
    }
    currentId = node.parentId;
  }

  // 如果找到了根节点，且它有初始内容，则插入到最前面
  if (agentNode && agentNode.initialContent && agentNode.initialContent.trim()) {
    history.unshift({
      role: 'system',
      content: agentNode.initialContent.trim(),
    });
  }

  return history;
}

// 检查是否会形成循环
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

// 获取从节点到根节点的祖先ID数组（包含自身）
export function getAncestorPath(nodes, nodeId) {
  const path = [nodeId];
  let current = nodes.find(n => n.id === nodeId);
  while (current?.parentId) {
    path.push(current.parentId);
    current = nodes.find(n => n.id === current.parentId);
  }
  return path;
}
