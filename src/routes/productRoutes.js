import express from 'express';
import Product from '../models/Product.js';
import { shopifyCrawler } from '../services/shopifyCrawler.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const products = await Product.find({})
      .sort({ syncedAt: -1 })
      .limit(50)
      .lean();
    
    res.json({ success: true, count: products.length, products });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const total = await Product.countDocuments();
    const shopify = await Product.countDocuments({ syncSource: 'shopify' });
    const inStock = await Product.countDocuments({ inStock: true });

    res.json({ success: true, total, shopify, inStock });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.post('/crawl', async (req, res) => {
  try {
    await shopifyCrawler.crawlAllProducts();
    const count = await Product.countDocuments();
    
    res.json({
      success: true,
      message: 'Crawl completed',
      productsInDatabase: count
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
