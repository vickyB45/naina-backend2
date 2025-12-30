import axios from 'axios';

export const generateResponse = async (messages) => {
  try {
    console.log('🧠 Calling Gemini API...');
    
    const lastMessage = messages[messages.length - 1].content;
    
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: lastMessage }]
        }]
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );
    
    console.log('✅ Gemini Response Received');
    return {
      content: response.data.candidates[0].content.parts[0].text,
      model: 'gemini',
      tokens: 0
    };
  } catch (error) {
    console.error('❌ Gemini Error:', error.response?.data || error.message);
    throw new Error('Gemini API failed');
  }
};
