// 预置两个Agent根节点，用户可通过前端修改配置（暂未实现UI，但可在代码中修改）
function makeAgent(id, name, model, apiType, envKey, baseURL) {
  return {
    id, name, model, apiType, baseURL,
    get apiKey() {
      return process.env[envKey] || '';
    },
  };
}

export const agents = {
  'deepseek': makeAgent('deepseek', 'DeepSeek', 'deepseek-v4-pro', 'openai', 'DEEPSEEK_API_KEY', 'https://api.deepseek.com'),
  // 'qwen': {
  //   id: 'qwen',
  //   name: 'Qwen',
  //   model: 'qwen-turbo',
  //   apiType: 'dashscope', // 阿里云通义千问
  //   apiKey: process.env.QWEN_API_KEY,
  //   baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  // },
  // 'openai': {
  //   id: 'openai',
  //   name: 'OpenAI',
  //   model: 'gpt-3.5-turbo',
  //   apiType: 'openai',
  //   apiKey: process.env.OPENAI_API_KEY,
  //   baseURL: 'https://api.openai.com/v1',
  // }
};

export function getAgentConfig(agentId) {
  return agents[agentId];
}
