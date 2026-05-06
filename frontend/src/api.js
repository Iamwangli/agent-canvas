import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export async function sendMessage(agentId, question, context, skipAutoAction = false) {
  const response = await api.post('/chat', { agentId, question, context, skipAutoAction });
  return response.data;
}

export async function getAgents() {
  const response = await api.get('/agents');
  return response.data;
}
