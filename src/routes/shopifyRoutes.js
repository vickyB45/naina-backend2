import express from 'express';
import { shopifyService } from '../services/shopifyService.js';
import Product from '../models/Product.js';

const router = express.Router();

// POST /api/shopify/sync - Manually trigger sync
router.post('/sync', async (req, res) => {
  try {
    console.log('\n🔄 Manual sync triggered via API...');
    
    const result = await shopifyService.syncAllProducts();
    
    const count = await Product.countDocuments({ syncSource: 'shopify' });
    
    res.json({
      success: true,
      message: 'Shopify sync complete',
      productsInShopify: result.total,
      productsSaved: result.saved,
      productsFailed: result.failed || 0,
      productsInDatabase: count
    });
  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/shopify/status - Check Shopify connection
router.get('/status', async (req, res) => {
  try {
    await shopifyService.initialize();
    
    const productCount = await Product.countDocuments({ syncSource: 'shopify' });
    
    res.json({
      success: true,
      connected: true,
      store: process.env.SHOPIFY_STORE,
      productsInDatabase: productCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message
    });
  }
});

export default router;
                        