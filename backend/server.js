import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { callLLM } from './llmClients.js';
import { getAgentConfig } from './agents.js';
import { agents } from './agents.js';

dotenv.config();
const app = express();

// 增加请求体大小限制
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.post('/api/chat', async (req, res) => {
  const { agentId, question, context } = req.body;
  try {
    const agent = getAgentConfig(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const answer = await callLLM(agent, question, context);
    const autoAction = detectAutoAction(answer, agent.name);
    res.json({ answer, autoAction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

function detectAutoAction(answer, currentAgentName) {
  const match = answer.match(/需要询问\s*(\w+)/i);
  if (match) {
    const targetAgentName = match[1];
    const question = `请回答：${answer.substring(0, 100)}...`;
    return { targetAgentName, question };
  }
  return null;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

app.get('/api/agents', (req, res) => {
  const agentList = Object.values(agents).map(agent => ({
    id: agent.id,
    name: agent.name,
    model: agent.model,
    type: 'agent',
  }));
  res.json(agentList);
});
