import Groq from 'groq-sdk';
import Product from '../models/Product.js';
import Conversation from '../models/Conversation.js';
import { getSession, updateSession, appendMessage, trackProductView } from './sessionStore.js';

// Get product catalog with price ranges
async function getProductCatalog() {
  try {
    const categories = await Product.aggregate([
      { $match: { price: { $gt: 0 } } },
      { 
        $group: { 
          _id: '$category',
          count: { $sum: 1 },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          samples: { $push: { name: '$name', price: '$price' } }
        }
      }
    ]);
    
    return categories.map(cat => {
      const items = cat.samples.slice(0, 3).map(s => `${s.name} (₹${s.price})`).join(', ');
      return `${cat._id} (${cat.count} items, ₹${Math.round(cat.minPrice)}-₹${Math.round(cat.maxPrice)}): ${items}`;
    }).join('\n');
  } catch (error) {
    return 'Rings, Necklaces, Bracelets, Earrings (₹200-₹2500)';
  }
}

// Build AI prompt with price understanding
async function buildSystemPrompt() {
  const catalog = await getProductCatalog();
  
  return `You are Naina, a friendly AI assistant at Crook Store jewelry shop.

PRODUCT CATALOG:
${catalog}

HOW TO SHOW PRODUCTS:
Use command: SHOW[keyword|minPrice|maxPrice]

EXAMPLES:

Input: "hi"
Output: "Hey! How's it going? 😊"

Input: "show me rings"
Output: "Here are our rings! SHOW[ring|0|10000]"

Input: "necklace under 1000"
Output: "Perfect! Necklaces under ₹1000: SHOW[necklace|0|1000]"

Input: "products above 1000"
Output: "Check out our premium collection above ₹1000: SHOW[jewelry|1000|10000]"

Input: "skull ring under 500"
Output: "Edgy skull rings under ₹500: SHOW[skull ring|0|500]"

Input: "expensive jewelry"
Output: "Our premium pieces above ₹1500: SHOW[jewelry|1500|10000]"

Input: "show products between 500 and 1000"
Output: "Great range! Here are items ₹500-₹1000: SHOW[jewelry|500|1000]"

RULES:
- Always respond naturally
- For price filters, use format: SHOW[keyword|minPrice|maxPrice]
- If user says "above X" → use minPrice=X, maxPrice=10000
- If user says "under X" → use minPrice=0, maxPrice=X
- If user says "between X and Y" → use minPrice=X, maxPrice=Y
- Keep responses SHORT (1-2 sentences)`;
}

// Extract SHOW command with price filters
function extractShowCommand(text) {
  const match = text.match(/SHOW\[([^\]]+)\]/i);
  if (!match) return null;
  
  const parts = match[1].split('|');
  return {
    search: parts[0].replace(/["']/g, '').trim(),
    minPrice: parts[1] ? parseInt(parts[1]) : 0,
    maxPrice: parts[2] ? parseInt(parts[2]) : 10000
  };
}

// Smart product search with price filtering
async function searchProducts(query, offset = 0) {
  if (!query || !query.search) return [];
  
  const keywords = query.search.toLowerCase();
  const minPrice = query.minPrice || 0;
  const maxPrice = query.maxPrice || 10000;
  
  console.log(`🔍 Searching: "${keywords}" | Price: ₹${minPrice}-₹${maxPrice}`);
  
  // Build search query with price filter
  const searchQuery = {
    $and: [
      {
        $or: [
          { name: { $regex: keywords, $options: 'i' } },
          { category: { $regex: keywords, $options: 'i' } },
          { description: { $regex: keywords, $options: 'i' } },
          { tags: { $regex: keywords, $options: 'i' } }
        ]
      },
      { price: { $gte: minPrice, $lte: maxPrice } }
    ]
  };
  
  // Special case: generic terms like "jewelry", "products"
  if (['jewelry', 'products', 'all', 'items'].includes(keywords)) {
    searchQuery.$and[0] = { price: { $gt: 0 } }; // Show all categories
  }
  
  const products = await Product.find(searchQuery)
    .sort({ price: 1 })
    .skip(offset)
    .limit(6)
    .lean();
  
  console.log(`📦 Found: ${products.length} products in price range`);
  
  if (products.length > 0) {
    products.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} - ₹${p.price} (${p.category})`);
    });
  } else {
    console.log(`⚠️ No products found for "${keywords}" in ₹${minPrice}-₹${maxPrice}`);
  }
  
  return products;
}

// Main processor
export async function processMessage(sessionId, userMessage, visitorInfo = {}) {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    let session = await getSession(sessionId, visitorInfo);
    const msg = userMessage.trim();
    
    await appendMessage(sessionId, 'user', msg);
    
    console.log('\n' + '='.repeat(70));
    console.log('💬 USER:', msg);
    
    // Build prompt
    const systemPrompt = await buildSystemPrompt();
    
    // Get conversation history
    const history = session.messages || [];
    
    // Build messages for AI
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add conversation history (last 8 messages)
    const recentHistory = history.slice(-8);
    recentHistory.forEach(h => {
      messages.push({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content
      });
    });
    
    // Add current message explicitly
    messages.push({
      role: 'user',
      content: msg
    });
    
    console.log('🤖 Calling Groq AI...');
    
    // Call Groq with proper settings
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messages,
      max_tokens: 150,
      temperature: 0.9,
      top_p: 0.95,
      frequency_penalty: 0.3,
      presence_penalty: 0.3
    });
    
    let aiReply = response.choices[0].message.content.trim();
    console.log('✅ AI RAW:', aiReply);
    
    // Extract SHOW command with price filters
    const showCmd = extractShowCommand(aiReply);
    
    // Clean response
    aiReply = aiReply.replace(/SHOW\[[^\]]+\]/gi, '').trim();
    
    console.log('💬 AI CLEAN:', aiReply);
    console.log('🛍️ SHOW CMD:', showCmd);
    
    // Fallback if empty
    if (!aiReply || aiReply.length < 3) {
      aiReply = "Hey! What can I help with? 😊";
    }
    
    // Save AI response
    await appendMessage(sessionId, 'assistant', aiReply);
    
    let products = [];
    
    // Search products if commanded
    if (showCmd) {
      console.log('🛍️ Executing search with price filter...');
      products = await searchProducts(showCmd, 0);
      
      await updateSession(sessionId, { 
        attributes: { 
          lastSearch: showCmd,
          productOffset: 0
        }
      });
      
      if (products.length > 0) {
        await trackProductView(sessionId, products.map(p => p.shopifyId));
      } else {
        // No products found in price range
        const noProductMsg = `Hmm, no products found in that price range. Try adjusting your budget! 😊`;
        
        const conv = await Conversation.findOne({ sessionId });
        if (conv && conv.messages.length > 0) {
          conv.messages[conv.messages.length - 1].content = noProductMsg;
          await conv.save();
        }
        
        console.log('='.repeat(70) + '\n');
        return { response: noProductMsg, products: [] };
      }
    }
    
    // Handle "more" requests
    if (/\b(more|next|another)\b/i.test(msg) && session.attributes?.lastSearch) {
      console.log('🔄 Show more requested');
      
      const offset = (session.attributes.productOffset || 0) + 6;
      products = await searchProducts(session.attributes.lastSearch, offset);
      
      await updateSession(sessionId, { 
        attributes: { 
          ...session.attributes, 
          productOffset: offset 
        }
      });
      
      if (products.length > 0) {
        await trackProductView(sessionId, products.map(p => p.shopifyId));
      } else {
        const noMoreMsg = "That's all in this range! Want to see something else? 😊";
        
        const conv = await Conversation.findOne({ sessionId });
        if (conv && conv.messages.length > 0) {
          conv.messages[conv.messages.length - 1].content = noMoreMsg;
          await conv.save();
        }
        
        console.log('='.repeat(70) + '\n');
        return { response: noMoreMsg, products: [] };
      }
    }
    
    console.log('✅ FINAL RESPONSE:', aiReply);
    console.log('📦 PRODUCTS:', products.length);
    console.log('='.repeat(70) + '\n');
    
    return { response: aiReply, products };
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.log('='.repeat(70) + '\n');
    
    const fallback = "Oops! Something went wrong 😅";
    await appendMessage(sessionId, 'assistant', fallback);
    return { response: fallback, products: [] };
  }
}
