import axios from 'axios';
import * as cheerio from 'cheerio';
import Product from '../models/Product.js';
import Policy from '../models/Policy.js';

/**
 * Advanced Knowledge Service - Provides Real Data Like ChatGPT
 */
export class AdvancedKnowledgeService {
  constructor() {
    this.knowledgeCache = new Map();
    this.cacheTimeout = 3600000; // 1 hour
  }

  /**
   * Main search function - searches all sources
   */
  async search(query, context = {}) {
    console.log(`\n🔍 ADVANCED SEARCH: "${query}"`);
    console.log('='*60);

    const results = {
      products: [],
      policies: [],
      faqs: [],
      websiteContent: [],
      sources: []
    };

    try {
      // Parallel search across all sources
      const [products, policies, websiteContent] = await Promise.all([
        this.searchProducts(query),
        this.searchPolicies(query),
        this.searchWebsiteContent(query, context.websiteUrl)
      ]);

      results.products = products;
      results.policies = policies;
      results.websiteContent = websiteContent;

      // Compile sources
      results.sources = this.compileSources(results);

      console.log(`✅ Search complete:`);
      console.log(`   Products: ${products.length}`);
      console.log(`   Policies: ${policies.length}`);
      console.log(`   Website content: ${websiteContent.length}`);
      console.log('='*60 + '\n');

      return results;

    } catch (error) {
      console.error('Search error:', error);
      return results;
    }
  }

  /**
   * Search real products from database
   */
  async searchProducts(query) {
    try {
      const keywords = this.extractKeywords(query);
      
      // Build MongoDB query
      const searchQuery = {
        $and: [
          { inStock: true },
          {
            $or: [
              { name: { $regex: keywords.join('|'), $options: 'i' } },
              { description: { $regex: keywords.join('|'), $options: 'i' } },
              { category: { $regex: keywords.join('|'), $options: 'i' } },
              { tags: { $in: keywords } }
            ]
          }
        ]
      };

      // Find matching products
      const products = await Product.find(searchQuery)
        .sort({ rating: -1 })
        .limit(10)
        .lean();

      console.log(`   📦 Found ${products.length} real products`);

      return products.map(p => ({
        id: p._id,
        name: p.name,
        description: p.description,
        price: p.price,
        image: p.image,
        url: p.url,
        inStock: p.inStock,
        rating: p.rating,
        source: 'database'
      }));

    } catch (error) {
      console.error('Product search error:', error);
      return [];
    }
  }

  /**
   * Search real policies
   */
  async searchPolicies(query) {
    try {
      const keywords = this.extractKeywords(query);
      
      const policies = await Policy.find({
        $or: [
          { title: { $regex: keywords.join('|'), $options: 'i' } },
          { content: { $regex: keywords.join('|'), $options: 'i' } }
        ]
      }).lean();

      console.log(`   📄 Found ${policies.length} relevant policies`);

      return policies.map(p => ({
        title: p.title,
        content: p.content,
        type: p.type,
        source: 'policy_database'
      }));

    } catch (error) {
      console.error('Policy search error:', error);
      return [];
    }
  }

  /**
   * Search real-time website content
   */
  async searchWebsiteContent(query, websiteUrl) {
    if (!websiteUrl) return [];

    try {
      // Check cache first
      const cacheKey = `website_${websiteUrl}`;
      if (this.knowledgeCache.has(cacheKey)) {
        const cached = this.knowledgeCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return this.searchCachedContent(query, cached.data);
        }
      }

      // Fetch live website content
      const response = await axios.get(websiteUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'Naina-Bot/1.0' }
      });

      const $ = cheerio.load(response.data);
      
      // Extract all text content
      $('script, style, nav, footer').remove();
      
      const content = {
        title: $('title').text(),
        description: $('meta[name="description"]').attr('content'),
        headings: [],
        paragraphs: [],
        lists: []
      };

      // Extract structured content
      $('h1, h2, h3').each((i, el) => {
        content.headings.push($(el).text().trim());
      });

      $('p').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 20) {
          content.paragraphs.push(text);
        }
      });

      $('ul, ol').each((i, el) => {
        const items = [];
        $(el).find('li').each((j, li) => {
          items.push($(li).text().trim());
        });
        content.lists.push(items);
      });

      // Cache the content
      this.knowledgeCache.set(cacheKey, {
        data: content,
        timestamp: Date.now()
      });

      return this.searchCachedContent(query, content);

    } catch (error) {
      console.error('Website content fetch error:', error);
      return [];
    }
  }

  /**
   * Search in cached website content
   */
  searchCachedContent(query, content) {
    const keywords = this.extractKeywords(query);
    const results = [];

    // Search in headings
    content.headings.forEach(heading => {
      if (this.matchesKeywords(heading, keywords)) {
        results.push({
          type: 'heading',
          content: heading,
          source: 'website'
        });
      }
    });

    // Search in paragraphs
    content.paragraphs.forEach(paragraph => {
      if (this.matchesKeywords(paragraph, keywords)) {
        results.push({
          type: 'paragraph',
          content: paragraph,
          source: 'website'
        });
      }
    });

    console.log(`    Found ${results.length} website content matches`);
    return results.slice(0, 5);
  }

  /**
   * Extract keywords from query
   */
  extractKeywords(query) {
    const stopWords = ['what', 'when', 'where', 'how', 'why', 'who', 'the', 'is', 'are', 'can', 'do', 'does', 'your', 'my', 'me', 'i', 'you', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
    
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));
  }

  /**
   * Check if text matches keywords
   */
  matchesKeywords(text, keywords) {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Compile all sources into formatted context
   */
  compileSources(results) {
    const sources = [];

    // Add product sources
    results.products.forEach(p => {
      sources.push({
        type: 'product',
        title: p.name,
        content: `${p.name} - ${p.description} (₹${p.price})`,
        url: p.url
      });
    });

    // Add policy sources
    results.policies.forEach(p => {
      sources.push({
        type: 'policy',
        title: p.title,
        content: p.content.substring(0, 300)
      });
    });

    // Add website sources
    results.websiteContent.forEach(w => {
      sources.push({
        type: 'website',
        title: w.type,
        content: w.content
      });
    });

    return sources;
  }

  /**
   * Format search results for AI prompt
   */
  formatForAI(results, query) {
    let context = `\n\n REAL DATA RETRIEVED FOR: "${query}"\n`;
    context += '='*60 + '\n\n';

    // Products section
    if (results.products.length > 0) {
      context += ` ACTUAL PRODUCTS (${results.products.length} found):\n\n`;
      results.products.forEach((product, i) => {
        context += `${i + 1}. ${product.name}\n`;
        context += `   Price: ₹${product.price}\n`;
        context += `   Description: ${product.description}\n`;
        context += `   Rating: ${product.rating}/5.0\n`;
        context += `   Stock: ${product.inStock ? 'Available' : 'Out of stock'}\n`;
        if (product.url) context += `   URL: ${product.url}\n`;
        context += '\n';
      });
    }

    // Policies section
    if (results.policies.length > 0) {
      context += ` ACTUAL POLICIES (${results.policies.length} found):\n\n`;
      results.policies.forEach((policy, i) => {
        context += `${i + 1}. ${policy.title}\n`;
        context += `   ${policy.content.substring(0, 200)}...\n\n`;
      });
    }

    // Website content section
    if (results.websiteContent.length > 0) {
      context += ` ACTUAL WEBSITE CONTENT (${results.websiteContent.length} found):\n\n`;
      results.websiteContent.forEach((content, i) => {
        context += `${i + 1}. [${content.type.toUpperCase()}] ${content.content}\n\n`;
      });
    }

    context += '='*60 + '\n';
    context += '\ IMPORTANT: Use ONLY the information above. Do not make up or hallucinate any details.\n';
    context += 'If information is not available above, say "I don\'t have that information right now."\n\n';

    return context;
  }
}

// Export singleton instance
export const knowledgeService = new AdvancedKnowledgeService();
