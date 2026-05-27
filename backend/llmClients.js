import OpenAI from 'openai';

export async function callLLM(agent, question, context) {
  const messages = [];
  for (const item of context) {
    // 处理系统消息（来自根节点初始提示词）
    if (item.role === 'system') {
      messages.push({ role: 'system', content: item.content });
      continue;
    }
    // 原有的摘要与问答处理
    if (item.summary) {
      messages.push({ role: 'system', content: `[对话摘要]：${item.summary}` });
    }
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
  });
  return response.choices[0].message.content;
}
