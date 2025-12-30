import axios from 'axios';
import Product from '../models/Product.js';

class ShopifyCrawler {
  constructor() {
    // Don't load env vars in constructor - they're not ready yet
    this.store = null;
    this.accessToken = null;
    this.apiVersion = '2023-04';
    this.baseUrl = null;
  }

  async initialize() {
    // Load env vars HERE, after dotenv.config() has run
    this.store = process.env.SHOPIFY_STORE;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    
    console.log('\n🔍 Checking Shopify credentials...');
    console.log('SHOPIFY_STORE:', this.store ? `✅ ${this.store}` : '❌ Not set');
    console.log('SHOPIFY_ACCESS_TOKEN:', this.accessToken ? '✅ Set' : '❌ Not set');
    
    if (!this.store || !this.accessToken) {
      throw new Error('SHOPIFY_STORE and SHOPIFY_ACCESS_TOKEN required in .env');
    }
    
    this.baseUrl = `https://${this.store}/admin/api/${this.apiVersion}`;

    try {
      const response = await axios.get(`${this.baseUrl}/shop.json`, {
        headers: { 'X-Shopify-Access-Token': this.accessToken },
        timeout: 10000
      });
      
      console.log(`✅ Shopify connected: ${response.data.shop.name}\n`);
      return true;
    } catch (error) {
      console.error('❌ Shopify connection failed:', error.message);
      throw error;
    }
  }

  async crawlAllProducts() {
    try {
      console.log('🕷️  Crawling Shopify products...');
      
      const response = await axios.get(`${this.baseUrl}/products.json`, {
        headers: { 'X-Shopify-Access-Token': this.accessToken },
        params: { limit: 250 },
        timeout: 30000
      });

      const products = response.data.products || [];
      console.log(`📦 Found ${products.length} products`);

      if (products.length === 0) {
        console.log('⚠️  No products in Shopify\n');
        return [];
      }

      await this.saveToDatabase(products);
      return products;

    } catch (error) {
      console.error('❌ Crawl failed:', error.message);
      throw error;
    }
  }

  async saveToDatabase(shopifyProducts) {
    console.log('💾 Saving to database...');
    
    let saved = 0;
    let updated = 0;

    for (const product of shopifyProducts) {
      try {
        const variant = product.variants?.[0];
        const qty = variant?.inventory_quantity || 0;

        const productData = {
          shopifyId: String(product.id),
          name: product.title,
          description: this.cleanHTML(product.body_html || ''),
          price: parseFloat(variant?.price || 0),
          compareAtPrice: parseFloat(variant?.compare_at_price || 0),
          image: product.image?.src || product.images?.[0]?.src || '',
          images: product.images?.map(img => img.src) || [],
          inStock: qty > 0,
          quantity: qty,
          category: product.product_type || 'Uncategorized',
          tags: product.tags ? product.tags.split(',').map(t => t.trim()) : [],
          url: `https://${this.store}/products/${product.handle}`,
          shopifyHandle: product.handle,
          variants: product.variants || [],
          syncSource: 'shopify',
          syncedAt: new Date()
        };

        const existing = await Product.findOne({ shopifyId: String(product.id) });
        
        if (existing) {
          await Product.updateOne({ shopifyId: String(product.id) }, { $set: productData });
          updated++;
        } else {
          await Product.create(productData);
          saved++;
        }

      } catch (error) {
        console.error(`   ❌ ${product.title}:`, error.message);
      }
    }

    console.log(`✅ Saved: ${saved} new, ${updated} updated\n`);
  }

  cleanHTML(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500);
  }

  startAutoCrawl(intervalMinutes = 60) {
    console.log(`⏰ Auto-crawl enabled (every ${intervalMinutes} min)\n`);
    
    setInterval(() => {
      console.log('⏰ Auto-crawl triggered...');
      this.crawlAllProducts().catch(err => {
        console.error('Auto-crawl error:', err.message);
      });
    }, intervalMinutes * 60 * 1000);
  }
}

export const shopifyCrawler = new ShopifyCrawler();
export default shopifyCrawler;
