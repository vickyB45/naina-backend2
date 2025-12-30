import axios from 'axios';

/**
 * OpenAI Service - Best quality responses
 * Uses GPT-3.5-turbo
 */

export async function callOpenAI(systemPrompt, conversationHistory, userMessage) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const messages = [
      { role: 'system', content: systemPrompt || 'You are a helpful assistant.' }
    ];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: String(msg.content || msg.text || '')
        });
      });
    }

    messages.push({ role: 'user', content: String(userMessage || 'Hello') });

    console.log('📤 Calling OpenAI API...');

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    console.log('✅ OpenAI response received');
    
    return aiResponse;
    
  } catch (error) {
    console.error('❌ OpenAI API Error:', error.response?.data || error.message);
    throw new Error('OpenAI API failed: ' + error.message);
  }
}

export default { callOpenAI };
