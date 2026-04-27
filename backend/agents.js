// 预置两个Agent根节点，用户可通过前端修改配置（暂未实现UI，但可在代码中修改）
export const agents = {
  'deepseek': {
    id: 'deepseek',
    name: 'DeepSeek',
    model: 'deepseek-v4-pro',
    apiType: 'openai',   // 使用OpenAI兼容接口
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: 'https://api.deepseek.com',
  }
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
