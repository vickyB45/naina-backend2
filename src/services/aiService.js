import axios from 'axios';

export async function callAI(systemPrompt, conversationHistory, userMessage, model = 'gemini') {
  try {
    console.log(`\n🤖 [${model.toUpperCase()}] Processing with REAL data...`);
    
    // Enhanced system instructions
    const enhancedSystemPrompt = `${systemPrompt}

🎯 CRITICAL INSTRUCTIONS FOR ACCURATE RESPONSES:
1. USE ONLY PROVIDED DATA
2. CITE SOURCES
3. ADMIT WHEN YOU DON'T KNOW
4. BE SPECIFIC
5. NO GENERIC RESPONSES
6. VERIFY AVAILABILITY
`;

    return await callGeminiWithRetry(enhancedSystemPrompt, conversationHistory, userMessage, 3);
    
  } catch (error) {
    console.error(`\n❌ [${model.toUpperCase()}] Error:`, error.message);
    return `I'm having trouble connecting right now. Please try again in a moment! 😊`;
  }
}

/**
 * Call Gemini with retry logic
 */
async function callGeminiWithRetry(systemPrompt, conversationHistory, userMessage, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   Attempt ${attempt}/${maxRetries}...`);
      return await callGemini(systemPrompt, conversationHistory, userMessage);
    } catch (error) {
      lastError = error;
      
      // If rate limited, wait before retrying
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
        console.log(`   ⏳ Rate limited, waiting ${waitTime/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // If it's not a rate limit error, don't retry
        throw error;
      }
    }
  }
  
  throw lastError;
}

async function callGemini(systemPrompt, conversationHistory, userMessage) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey.includes('your_') || apiKey.length < 10) {
    throw new Error('GEMINI_API_KEY is invalid or not set');
  }

  try {
    console.log('📤 Sending to Gemini API...');

    const context = conversationHistory
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const fullPrompt = `${systemPrompt}\n\nConversation History:\n${context}\n\nUser: ${userMessage}\n\nAssistant:`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{ text: fullPrompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 200,
          topP: 0.8
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );

    const reply = response.data.candidates[0].content.parts[0].text.trim();
    console.log('✅ Gemini response received');
    return reply;

  } catch (error) {
    const status = error.response?.status;
    const errorData = error.response?.data;
    
    console.error('❌ Gemini API Error:', {
      status,
      message: errorData?.error?.message || error.message
    });
    
    if (status === 429) {
      throw new Error('Gemini rate limited. Try again in a moment.');
    } else if (status === 401 || status === 403) {
      throw new Error('Gemini API key invalid or rate limited');
    } else {
      throw new Error(`Gemini API error: ${errorData?.error?.message || error.message}`);
    }
  }
}
