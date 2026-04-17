import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { callLLM } from './llmClients.js';
import { getAgentConfig } from './agents.js';
import { agents } from './agents.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { agentId, question, context } = req.body;
  try {
    const agent = getAgentConfig(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const answer = await callLLM(agent, question, context);
    // 可选：自动检测是否需要调用其他agent（简单关键词匹配示例）
    const autoAction = detectAutoAction(answer, agent.name);
    res.json({ answer, autoAction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

function detectAutoAction(answer, currentAgentName) {
  // 示例规则：如果回复中提到"需要询问[AgentName]"，则触发自动创建
  const match = answer.match(/需要询问\s*(\w+)/i);
  if (match) {
    const targetAgentName = match[1];
    // 简单生成一个问题（实际可让LLM提取，这里用固定模板）
    const question = `请回答：${answer.substring(0, 100)}...`;
    return { targetAgentName, question };
  }
  return null;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

// 新增：获取所有 Agent 列表（供前端初始化）
app.get('/api/agents', (req, res) => {
  const agentList = Object.values(agents).map(agent => ({
    id: agent.id,
    name: agent.name,
    model: agent.model,
    type: 'agent',
  }));
  res.json(agentList);
});
