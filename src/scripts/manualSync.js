import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { syncShopifyProducts } from '../services/shopifySync.js';

dotenv.config();

console.log('🚀 Manual Shopify Sync Script\n');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected\n');
    
    const useAI = process.argv.includes('--ai');
    console.log(`Azure AI: ${useAI ? 'ENABLED' : 'DISABLED'}\n`);
    
    await syncShopifyProducts(useAI);
    
    console.log('\n✅ Sync complete! Exiting...\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
