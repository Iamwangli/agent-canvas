import OpenAI from 'openai';

// export async function callLLM(agent, question, context) {
//   // 构建消息
//   const messages = [];
//   // 添加上下文（历史对话）
//   for (const item of context) {
//     messages.push({ role: 'user', content: item.question });
//     messages.push({ role: 'assistant', content: item.answer });
//   }
//   messages.push({ role: 'user', content: question });
// 
//   // 根据apiType调用不同客户端
//   if (agent.apiType === 'openai') {
//     const client = new OpenAI({
//       apiKey: agent.apiKey,
//       baseURL: agent.baseURL,
//     });
//     const response = await client.chat.completions.create({
//       model: agent.model,
//       messages: messages,
//       temperature: 0.7,
//     });
//     return response.choices[0].message.content;
//   } else if (agent.apiType === 'dashscope') {
//     // 通义千问兼容OpenAI接口，同样使用OpenAI库
//     const client = new OpenAI({
//       apiKey: agent.apiKey,
//       baseURL: agent.baseURL,
//     });
//     const response = await client.chat.completions.create({
//       model: agent.model,
//       messages: messages,
//     });
//     return response.choices[0].message.content;
//   } else {
//     throw new Error(`Unsupported apiType: ${agent.apiType}`);
//   }
// }

// export async function callLLM(agent, question, context) {
//   // 临时测试：直接返回模拟回复
//   return `这是模拟回复。您的问题是："${question}"，上下文包含 ${context.length} 条历史。`;
// }



export async function callLLM(agent, question, context) {
  const messages = [];
  for (const item of context) {
    messages.push({ role: 'user', content: item.question });
    messages.push({ role: 'assistant', content: item.answer });
  }
  messages.push({ role: 'user', content: question });

  const client = new OpenAI({
    apiKey: agent.apiKey,
    baseURL: agent.baseURL,
  });

  const response = await client.chat.completions.create({
    model: agent.model,
    messages: messages,
    temperature: 0.7,
    reasoning_effort: 'high',  // 或 'max'
    extra_body: { thinking: { type: 'enabled' } }
  });
  return response.choices[0].message.content;
}
