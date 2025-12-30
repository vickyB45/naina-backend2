import axios from 'axios';
import Product from '../models/Product.js';

class ShopifyService {
  constructor() {
    this.store = null;
    this.accessToken = null;
    this.baseUrl = null;
    this.syncInterval = null;
  }

  async initialize() {
    console.log('\n🏪 Initializing Shopify Service...');
    
    this.store = process.env.SHOPIFY_STORE;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    
    console.log('🔍 Checking credentials...');
    console.log('   SHOPIFY_STORE:', this.store ? `✅ ${this.store}` : '❌ Not set');
    console.log('   SHOPIFY_ACCESS_TOKEN:', this.accessToken ? '✅ Set' : '❌ Not set');
    
    if (!this.store || !this.accessToken) {
      throw new Error('Shopify credentials not configured');
    }
    
    // Use 2023-04 API version (supports simple pagination)
    this.baseUrl = `https://${this.store}/admin/api/2023-04`;
    
    try {
      const response = await axios.get(`${this.baseUrl}/shop.json`, {
        headers: { 'X-Shopify-Access-Token': this.accessToken },
        timeout: 10000
      });
      
      console.log(`✅ Shopify connected: ${response.data.shop.name}\n`);
      return true;
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      throw error;
    }
  }

  async syncAllProducts() {
    try {
      console.log('🔄 Fetching products from Shopify...');
      
      const response = await axios.get(`${this.baseUrl}/products.json`, {
        headers: { 'X-Shopify-Access-Token': this.accessToken },
        params: { limit: 250 },
        timeout: 30000
      });

      const products = response.data.products || [];
      
      console.log(`📦 Found ${products.length} products`);

      if (products.length === 0) {
        console.log('⚠️  No products in store\n');
        return { total: 0, saved: 0 };
      }

      console.log('💾 Saving to database...');
      let saved = 0;

      for (const product of products) {
        try {
          await this.upsertProduct(product);
          saved++;
          
          if (saved % 5 === 0) {
            console.log(`   ✓ ${saved}/${products.length}`);
          }
        } catch (err) {
          console.error(`   ✗ ${product.title}:`, err.message);
        }
      }

      console.log(`\n✅ Sync complete: ${saved}/${products.length} saved\n`);
      return { total: products.length, saved };
      
    } catch (error) {
      console.error('❌ Sync failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async upsertProduct(shopifyProduct) {
    const variant = shopifyProduct.variants?.[0];
    const qty = variant?.inventory_quantity || 0;

    await Product.findOneAndUpdate(
      { shopifyId: String(shopifyProduct.id) },
      {
        $set: {
          shopifyId: String(shopifyProduct.id),
          name: shopifyProduct.title,
          description: this.cleanHTML(shopifyProduct.body_html || '').substring(0, 500),
          price: parseFloat(variant?.price || 0),
          compareAtPrice: parseFloat(variant?.compare_at_price || 0),
          image: shopifyProduct.image?.src || shopifyProduct.images?.[0]?.src || '',
          images: shopifyProduct.images?.map(img => img.src) || [],
          inStock: qty > 0,
          quantity: qty,
          category: shopifyProduct.product_type || 'Uncategorized',
          tags: shopifyProduct.tags?.split(',').map(t => t.trim()).filter(Boolean) || [],
          url: `https://${this.store}/products/${shopifyProduct.handle}`,
          shopifyHandle: shopifyProduct.handle,
          variants: shopifyProduct.variants || [],
          syncSource: 'shopify',
          syncedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );
  }

  cleanHTML(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  startAutoSync() {
    console.log('⏰ Auto-sync enabled (every 5 minutes)\n');
    this.syncInterval = setInterval(() => {
      console.log('⏰ Auto-sync triggered...');
      this.syncAllProducts().catch(err => {
        console.error('Auto-sync error:', err.message);
      });
    }, 5 * 60 * 1000);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const shopifyService = new ShopifyService();
export default shopifyService;
