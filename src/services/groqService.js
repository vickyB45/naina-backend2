import axios from 'axios';

export async function callGroq(systemPrompt, conversationHistory, userMessage) {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const messages = [{ role: 'system', content: systemPrompt }];

    if (conversationHistory?.length) {
      conversationHistory.slice(-2).forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: String(msg.content || '')
        });
      });
    }

    messages.push({ role: 'user', content: String(userMessage) });

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: messages,
        temperature: 0.7,
        max_tokens: 50,
        top_p: 0.9,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }
    );

    return response.data.choices[0].message.content;
    
  } catch (error) {
    console.error('Groq Error:', error.response?.data || error.message);
    return "Let me help you! ✨";
  }
}

export default { callGroq };
