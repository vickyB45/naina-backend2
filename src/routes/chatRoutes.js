import express from 'express';
import { processMessage } from '../services/conversationManager.js';
import { analyzeAllProducts } from '../services/visualAnalysis.js';
import Conversation from '../models/Conversation.js';

const router = express.Router();

router.post('/message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing sessionId or message' });
    }
    const result = await processMessage(sessionId, message);
    res.json(result);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const doc = await Conversation.findOne({ sessionId });
    if (!doc) return res.json([]);
    res.json(doc.messages || []);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Analyze all products (run once)
router.post('/analyze-products', async (req, res) => {
  try {
    console.log('🚀 Starting product analysis...');
    analyzeAllProducts()
      .then(result => console.log('✅ Analysis done:', result))
      .catch(err => console.error('❌ Error:', err));
    
    res.json({ success: true, message: 'Analysis started in background' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
