import axios from 'axios';

export async function generateAIResponse(messages, model = 'groq') {
  try {
    if (model === 'groq') {
      return await callGroq(messages);
    } else if (model === 'gemini') {
      return await callGemini(messages);
    }
    return await callGroq(messages);
  } catch (error) {
    console.error('AI Error:', error.message);
    // Fallback to other model
    try {
      if (model !== 'groq') {
        console.log('Falling back to Groq...');
        return await callGroq(messages);
      } else {
        console.log('Falling back to Gemini...');
        return await callGemini(messages);
      }
    } catch (fallbackError) {
      // Ultimate fallback: return a friendly error message
      return {
        content: "I'm here to help! What are you looking for today? 😊",
        model: 'fallback'
      };
    }
  }
}

async function callGroq(messages) {
  console.log('🚀 Calling Groq AI...');
  
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.1-70b-versatile',
      messages: messages,
      temperature: 0.7,
      max_tokens: 150, // Short responses
      top_p: 0.9
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );
  
  console.log('✅ Groq Response Received');
  
  return {
    content: response.data.choices[0].message.content.trim(),
    model: 'groq'
  };
}

async function callGemini(messages) {
  console.log('🧠 Calling Gemini AI...');
  
  // Convert messages to Gemini format
  const prompt = messages
    .filter(m => m.role !== 'system')
    .map(m => m.content)
    .join('\n');
  
  const systemContext = messages.find(m => m.role === 'system')?.content || '';
  const fullPrompt = systemContext + '\n\n' + prompt;
  
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{
        parts: [{ text: fullPrompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 150
      }
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    }
  );
  
  console.log('✅ Gemini Response Received');
  
  return {
    content: response.data.candidates[0].content.parts[0].text.trim(),
    model: 'gemini'
  };
}
