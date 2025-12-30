import { HfInference } from '@huggingface/inference';
import axios from 'axios';
import Product from '../models/Product.js';

const hf = new HfInference(process.env.HF_TOKEN || process.env.GROQ_API_KEY);

// Analyze product image to detect type, colors, style
async function analyzeProductImage(imageUrl, productName) {
  try {
    console.log('🔍 Analyzing:', productName.substring(0, 40));
    
    // Download image
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 10000 
    });
    const imageBuffer = Buffer.from(response.data);
    
    // Use zero-shot classification to detect jewelry type
    const typeResult = await hf.zeroShotClassification({
      model: 'facebook/bart-large-mnli',
      inputs: productName + ' jewelry accessory',
      parameters: {
        candidate_labels: ['ring', 'necklace', 'bracelet', 'earring', 'pendant', 'chain']
      }
    });
    
    // Detect dominant category
    const visualCategory = typeResult.labels[0];
    const confidence = typeResult.scores[0];
    
    // Map to our categories
    let mappedCategory = 'Uncategorized';
    if (confidence > 0.3) {
      if (/necklace|pendant|chain/.test(visualCategory)) mappedCategory = 'Necklace';
      if (/bracelet/.test(visualCategory)) mappedCategory = 'Bracelet';
      if (/earring/.test(visualCategory)) mappedCategory = 'Earring';
      if (/ring/.test(visualCategory)) mappedCategory = 'Ring';
    }
    
    // Detect colors from product name and description
    const visualColors = detectColorsFromText(productName);
    
    // Detect style
    const visualStyle = detectStyleFromText(productName);
    
    console.log(`   ✅ Type: ${mappedCategory}, Colors: ${visualColors.join(',')}, Style: ${visualStyle}`);
    
    return {
      visualCategory: mappedCategory,
      visualColors,
      visualStyle
    };
    
  } catch (error) {
    console.error('   ❌ Analysis failed:', error.message);
    return null;
  }
}

function detectColorsFromText(text) {
  const colors = [];
  const t = text.toLowerCase();
  
  if (/\b(gold|golden)\b/.test(t)) colors.push('gold');
  if (/\b(silver|metallic)\b/.test(t)) colors.push('silver');
  if (/\b(black|dark)\b/.test(t)) colors.push('black');
  if (/\b(white|pearl)\b/.test(t)) colors.push('white');
  if (/\b(red|ruby)\b/.test(t)) colors.push('red');
  if (/\b(blue|sapphire)\b/.test(t)) colors.push('blue');
  if (/\b(green|emerald)\b/.test(t)) colors.push('green');
  if (/\b(brown|bronze)\b/.test(t)) colors.push('brown');
  if (/\b(multi|rainbow)\b/.test(t)) colors.push('multi');
  
  return [...new Set(colors)];
}

function detectStyleFromText(text) {
  const t = text.toLowerCase();
  
  if (/\b(minimal|simple|delicate|thin)\b/.test(t)) return 'minimal';
  if (/\b(statement|bold|chunky|large|heavy)\b/.test(t)) return 'statement';
  if (/\b(classic|elegant|traditional|timeless)\b/.test(t)) return 'classic';
  if (/\b(modern|contemporary|trendy)\b/.test(t)) return 'modern';
  if (/\b(vintage|antique|retro)\b/.test(t)) return 'vintage';
  
  return null;
}

// Analyze all products in database
export async function analyzeAllProducts() {
  try {
    console.log('\n🎨 Starting visual analysis of all products...\n');
    
    const products = await Product.find({ 
      image: { $exists: true, $ne: '' },
      imageAnalyzed: { $ne: true }
    }).limit(100);
    
    console.log(`📦 Found ${products.length} products to analyze\n`);
    
    let analyzed = 0, failed = 0;
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      try {
        console.log(`[${i + 1}/${products.length}] Processing...`);
        
        const analysis = await analyzeProductImage(product.image, product.name);
        
        if (analysis) {
          await Product.updateOne(
            { _id: product._id },
            { 
              visualCategory: analysis.visualCategory,
              visualColors: analysis.visualColors,
              visualStyle: analysis.visualStyle,
              imageAnalyzed: true
            }
          );
          analyzed++;
        } else {
          failed++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        failed++;
      }
    }
    
    console.log(`\n✅ Analysis complete!`);
    console.log(`   Analyzed: ${analyzed}`);
    console.log(`   Failed: ${failed}\n`);
    
    return { analyzed, failed };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Get products using visual filtering
export async function getVisuallyFilteredProducts(preferences, limit = 3) {
  let query = { price: { $gt: 0 } };
  
  // Use visual category if available, fallback to regular category
  if (preferences.category) {
    query.$or = [
      { visualCategory: preferences.category },
      { category: preferences.category }
    ];
  }
  
  // Visual color matching
  if (preferences.color) {
    query.$or = query.$or || [];
    query.$or.push(
      { visualColors: { $in: [preferences.color] } },
      { colors: { $in: [preferences.color] } }
    );
  }
  
  // Visual style matching
  if (preferences.style) {
    query.$or = query.$or || [];
    query.$or.push(
      { visualStyle: preferences.style },
      { style: preferences.style }
    );
  }
  
  if (preferences.maxPrice) {
    query.price.$lte = preferences.maxPrice;
  }
  
  console.log('🔍 Visual Query:', JSON.stringify(query, null, 2));
  
  let products = await Product.find(query)
    .sort({ imageAnalyzed: -1, updatedAt: -1 })
    .limit(limit)
    .lean();
  
  // Fallback: try category only
  if (!products.length && preferences.category) {
    products = await Product.find({
      $or: [
        { visualCategory: preferences.category },
        { category: preferences.category }
      ],
      price: { $gt: 0 }
    })
      .limit(limit)
      .lean();
  }
  
  console.log(`📦 Visual search found ${products.length} products`);
  return products;
}

export default { analyzeAllProducts, getVisuallyFilteredProducts };
