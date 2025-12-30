import fetch from 'node-fetch';
import Product from '../models/Product.js';

function extractCategory(productName, tags = []) {
  const name = productName.toLowerCase();
  const tagStr = tags.join(' ').toLowerCase();
  
  if (/\bring\b/.test(tagStr) && !/necklace|pendant|bracelet|earring/.test(tagStr)) return 'Ring';
  if (/necklace|pendant|chain/.test(tagStr)) return 'Necklace';
  if (/bracelet|bangle/.test(tagStr)) return 'Bracelet';
  if (/earring/.test(tagStr)) return 'Earring';
  
  if (/necklace|pendant|locket|chain|haar/.test(name)) return 'Necklace';
  if (/bracelet|kada|band|bangle/.test(name)) return 'Bracelet';
  if (/earring|jhumka|bali|earstud|tops/.test(name)) return 'Earring';
  if (/\bring\b|\brings\b|anguthi/.test(name)) return 'Ring';
  
  return 'Uncategorized';
}

function extractColors(productName, tags = []) {
  const colors = [];
  const text = `${productName} ${tags.join(' ')}`.toLowerCase();
  if (/\b(gold|golden)\b/.test(text)) colors.push('gold');
  if (/\b(silver)\b/.test(text)) colors.push('silver');
  if (/\b(black)\b/.test(text)) colors.push('black');
  if (/\b(white|pearl)\b/.test(text)) colors.push('white');
  if (/\b(red)\b/.test(text)) colors.push('red');
  if (/\b(multi|multicolor)\b/.test(text)) colors.push('multi');
  if (/\b(green)\b/.test(text)) colors.push('green');
  if (/\b(blue)\b/.test(text)) colors.push('blue');
  return [...new Set(colors)];
}

function extractStyle(productName, tags = []) {
  const text = `${productName} ${tags.join(' ')}`.toLowerCase();
  if (/minimal|simple|plain/.test(text)) return 'minimal';
  if (/classic|traditional|elegant/.test(text)) return 'classic';
  if (/statement|bold|party|fancy/.test(text)) return 'statement';
  return null;
}

async function fetchAllShopifyProducts() {
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
  const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';
  
  if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
    throw new Error('Shopify credentials not found!');
  }
  
  try {
    let allProducts = [];
    let hasNextPage = true;
    let pageInfo = null;

    console.log('📡 Fetching from Shopify...');

    while (hasNextPage) {
      const url = pageInfo 
        ? `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=250&page_info=${pageInfo}`
        : `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=250`;

      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`Shopify API error: ${response.status}`);
      const data = await response.json();
      allProducts.push(...(data.products || []));

      const linkHeader = response.headers.get('Link');
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&]+)[^>]*>;\s*rel="next"/);
        pageInfo = nextMatch ? nextMatch[1] : null;
        hasNextPage = !!pageInfo;
      } else {
        hasNextPage = false;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ Total: ${allProducts.length}`);
    return allProducts;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

function transformProduct(shopifyProduct) {
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const variant = shopifyProduct.variants?.[0] || {};
  const totalInventory = shopifyProduct.variants?.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0) || 0;
  const tags = shopifyProduct.tags?.split(',').map(t => t.trim()) || [];
  
  return {
    shopifyId: shopifyProduct.id.toString(),
    name: shopifyProduct.title,
    description: shopifyProduct.body_html?.replace(/<[^>]*>/g, '').substring(0, 500) || '',
    price: parseFloat(variant.price) || 0,
    compareAtPrice: parseFloat(variant.compare_at_price) || 0,
    image: shopifyProduct.image?.src || shopifyProduct.images?.[0]?.src || '',
    images: shopifyProduct.images?.map(img => img.src) || [],
    inStock: true,
    quantity: totalInventory,
    category: extractCategory(shopifyProduct.title, tags),
    style: extractStyle(shopifyProduct.title, tags),
    colors: extractColors(shopifyProduct.title, tags),
    tags: tags,
    url: `https://${SHOPIFY_STORE}/products/${shopifyProduct.handle}`,
    shopifyHandle: shopifyProduct.handle,
    variants: shopifyProduct.variants?.map(v => ({
      id: v.id.toString(),
      title: v.title,
      price: parseFloat(v.price),
      sku: v.sku,
      inventoryQuantity: v.inventory_quantity || 0,
      available: v.available || false
    })) || [],
    syncSource: 'shopify',
    syncedAt: new Date()
  };
}

export async function syncShopifyProducts() {
  try {
    console.log('\n🕷️  Starting sync...');
    const shopifyProducts = await fetchAllShopifyProducts();
    
    if (!shopifyProducts.length) {
      console.log('⚠️  No products');
      return { newCount: 0, updatedCount: 0, total: 0 };
    }

    console.log(`💾 Processing ${shopifyProducts.length}...`);
    let newCount = 0, updatedCount = 0;

    for (let i = 0; i < shopifyProducts.length; i++) {
      const productData = transformProduct(shopifyProducts[i]);
      const existing = await Product.findOne({ shopifyId: productData.shopifyId });
      
      if (existing) {
        await Product.updateOne({ shopifyId: productData.shopifyId }, productData);
        updatedCount++;
      } else {
        await Product.create(productData);
        newCount++;
      }
      
      if ((i + 1) % 50 === 0) console.log(`   ✓ ${i + 1}/${shopifyProducts.length}`);
    }

    console.log(`\n✅ Done! New: ${newCount}, Updated: ${updatedCount}\n`);
    return { newCount, updatedCount, total: shopifyProducts.length };
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    throw error;
  }
}

export function startAutoSync(intervalMinutes = 60) {
  console.log(`⏰ Auto-sync: every ${intervalMinutes} min\n`);
  syncShopifyProducts().catch(console.error);
  setInterval(() => {
    console.log('🔄 Scheduled sync...');
    syncShopifyProducts().catch(console.error);
  }, intervalMinutes * 60 * 1000);
}
