import { processMessage } from '../services/conversationManager.js';

export const handleMessage = async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    
    // Force Gemini model - ignore any 'model' parameter
    const model = 'gemini';

    if (!sessionId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: sessionId and message' 
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📨 New chat message received`);
    console.log(`   Session: ${sessionId}`);
    console.log(`   Message: "${message}"`);
    console.log(`   Model: GEMINI (forced)`);
    console.log('='.repeat(60));

    const result = await processMessage(sessionId, message, model);

    console.log('\n✅ Response sent successfully\n');

    res.json({
      response: result.response,
      stage: result.stage,
      intent: result.intent,
      products: result.products || [],
      policies: result.policies || []
    });

  } catch (error) {
    console.error('\n❌ Chat Controller Error:', error.message);
    
    res.status(500).json({ 
      error: 'Failed to process message',
      details: error.message
    });
  }
};

export const getConversation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const Conversation = (await import('../models/Conversation.js')).default;
    const conversation = await Conversation.findOne({ sessionId });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      sessionId: conversation.sessionId,
      messages: conversation.messages,
      stage: conversation.currentStage,
      intent: conversation.intentLevel
    });

  } catch (error) {
    console.error('Get Conversation Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch conversation',
      details: error.message 
    });
  }
};
    