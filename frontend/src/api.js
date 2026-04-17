import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export async function sendMessage(agentId, question, context) {
  const response = await api.post('/chat', { agentId, question, context });
  return response.data;
}

export async function getAgents() {
  const response = await api.get('/agents');
  return response.data;
}
