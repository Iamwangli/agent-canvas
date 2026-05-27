import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取初始提示词（若文件不存在或为空，则为空字符串）
let defaultPrompt = '';
try {
  const promptPath = path.join(__dirname, 'agent_initprompt.txt');
  if (fs.existsSync(promptPath)) {
    defaultPrompt = fs.readFileSync(promptPath, 'utf-8').trim();
  }
} catch (e) {
  console.warn('无法读取 agent_initprompt.txt，将使用空提示词', e.message);
}

// 预置两个Agent根节点，用户可通过前端修改配置（暂未实现UI，但可在代码中修改）
function makeAgent(id, name, model, apiType, envKey, baseURL) {
  return {
    id,
    name,
    model,
    apiType,
    baseURL,
    get apiKey() {
      return process.env[envKey] || '';
    },
    // 所有 agent 共享同一个初始提示词（如需不同，可传参区分）
    initialContent: defaultPrompt,
  };
}

export const agents = {
  'deepseek': makeAgent('deepseek', 'DeepSeek', 'deepseek-v4-pro', 'openai', 'DEEPSEEK_API_KEY', 'https://api.deepseek.com'),
};

export function getAgentConfig(agentId) {
  return agents[agentId];
}
