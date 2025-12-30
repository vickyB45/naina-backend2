import axios from 'axios';

/**
 * Shopify REST API Client
 * Handles all communication with Shopify Admin API
 */
export class ShopifyAPI {
  constructor() {
    // Defer reading environment variables until runtime to avoid
    // initialization-time issues when dotenv hasn't been loaded yet.
    this.apiVersionDefault = '2024-01';
  }

  /**
   * Validate Shopify credentials
   */
  validateCredentials() {
    const domain = this.getShopifyDomain();
    const token = this.getAccessToken();

    if (!domain || domain.includes('your-')) {
      console.warn('⚠️ SHOPIFY_STORE not configured. Using fallback mode.');
      return false;
    }
    if (!token || token.includes('your_') || token.length < 10) {
      console.warn('⚠️ SHOPIFY_ACCESS_TOKEN not configured or invalid. Using fallback mode.');
      return false;
    }

    console.log('✅ Shopify credentials validated');
    return true;
  }

  /**
   * Get request headers with auth token
   */
  getHeaders() {
    return {
      'X-Shopify-Access-Token': this.getAccessToken(),
      'Content-Type': 'application/json'
    };
  }

  /**
   * Fetch all products with pagination
   * @param {number} limit - Items per page (max 250)
   * @param {string} after - Cursor for pagination
   */
  async getProducts(limit = 50, after = null) {
    try {
      let url = `${this.getBaseURL()}/products.json?first=${Math.min(limit, 250)}`;
      if (after) url += `&after=${after}`;

      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: 15000
      });

      console.log(`📦 Fetched ${response.data.products.length} products from Shopify`);
      return response.data;

    } catch (error) {
      console.error('❌ Error fetching Shopify products:', error.message);
      throw error;
    }
  }

  /**
   * Get single product with full details
   * @param {string} productId - Shopify product ID
   */
  async getProduct(productId) {
    try {
      const response = await axios.get(
        `${this.getBaseURL()}/products/${productId}.json`,
        {
          headers: this.getHeaders(),
          timeout: 15000
        }
      );

      return response.data.product;

    } catch (error) {
      console.error(`❌ Error fetching product ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Search products by title
   * @param {string} query - Search query
   * @param {number} limit - Max results
   */
  async searchProducts(query, limit = 10) {
    try {
      const response = await axios.get(
        `${this.getBaseURL()}/products.json?title=${encodeURIComponent(query)}&limit=${limit}`,
        {
          headers: this.getHeaders(),
          timeout: 15000
        }
      );

      console.log(`🔍 Found ${response.data.products.length} products matching "${query}"`);
      return response.data.products;

    } catch (error) {
      console.error('❌ Error searching Shopify products:', error.message);
      throw error;
    }
  }

  /**
   * Get inventory levels for items
   * @param {array} inventoryItemIds - Array of inventory item IDs
   */
  async getInventoryLevels(inventoryItemIds) {
    try {
      const ids = inventoryItemIds.join(',');
      const response = await axios.get(
        `${this.getBaseURL()}/inventory_levels.json?inventory_item_ids=${ids}`,
        {
          headers: this.getHeaders(),
          timeout: 15000
        }
      );

      return response.data.inventory_levels;

    } catch (error) {
      console.error('❌ Error fetching inventory levels:', error.message);
      throw error;
    }
  }

  /**
   * Create a draft order (first step before checkout)
   * @param {object} orderData - Order details
   */
  async createDraftOrder(orderData) {
    try {
      const response = await axios.post(
        `${this.getBaseURL()}/draft_orders.json`,
        { draft_order: orderData },
        {
          headers: this.getHeaders(),
          timeout: 15000
        }
      );

      console.log(`📝 Created draft order: ${response.data.draft_order.id}`);
      return response.data.draft_order;

    } catch (error) {
      console.error('❌ Error creating draft order:', error.message);
      throw error;
    }
  }

  /**
   * Get customer info
   * @param {string} email - Customer email
   */
  async getCustomer(email) {
    try {
      const response = await axios.get(
        `${this.getBaseURL()}/customers/search.json?query=email:${email}`,
        {
          headers: this.getHeaders(),
          timeout: 15000
        }
      );

      return response.data.customers[0] || null;

    } catch (error) {
      console.error('❌ Error fetching customer:', error.message);
      throw error;
    }
  }

  /**
   * Create or update customer
   * @param {object} customerData - Customer details
   */
  async upsertCustomer(customerData) {
    try {
      const response = await axios.post(
        `${this.getBaseURL()}/customers.json`,
        { customer: customerData },
        {
          headers: this.getHeaders(),
          timeout: 15000
        }
      );

      console.log(`👤 Created/Updated customer: ${response.data.customer.email}`);
      return response.data.customer;

    } catch (error) {
      console.error('❌ Error upserting customer:', error.message);
      throw error;
    }
  }

  /**
   * Get store info
   */
  async getShop() {
    try {
      const response = await axios.get(
        `${this.getBaseURL()}/shop.json`,
        {
          headers: this.getHeaders(),
          timeout: 15000
        }
      );

      return response.data.shop;

    } catch (error) {
      console.error('❌ Error fetching shop info:', error.message);
      throw error;
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      const shop = await this.getShop();
      console.log(`✅ Shopify connected: ${shop.name}`);
      return true;
    } catch (error) {
      console.error('❌ Shopify connection failed:', error.message);
      return false;
    }
  }
}

// Helper methods to defer env reading
ShopifyAPI.prototype.getShopifyDomain = function() {
  return process.env.SHOPIFY_STORE;
};

ShopifyAPI.prototype.getAccessToken = function() {
  return process.env.SHOPIFY_ACCESS_TOKEN;
};

ShopifyAPI.prototype.getApiVersion = function() {
  return process.env.SHOPIFY_API_VERSION || this.apiVersionDefault;
};

ShopifyAPI.prototype.getBaseURL = function() {
  const domain = this.getShopifyDomain();
  // Ensure domain isn't empty and does not contain protocol
  if (!domain) return `https://undefined/admin/api/${this.getApiVersion()}`;
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `https://${cleanDomain}/admin/api/${this.getApiVersion()}`;
};

// Export a singleton instance (safe because methods read env at call-time)
export const shopifyAPI = new ShopifyAPI();
