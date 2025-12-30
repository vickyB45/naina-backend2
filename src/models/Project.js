import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  shopifyId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: String,
  price: Number,
  compareAtPrice: Number,
  image: String,
  images: [String],
  inStock: Boolean,
  quantity: Number,
  category: { type: String, index: true },
  style: String,
  colors: [String],
  tags: [String],
  url: String,
  shopifyHandle: String,
  variants: [{
    id: String,
    title: String,
    price: Number,
    sku: String,
    inventoryQuantity: Number,
    available: Boolean
  }],
  syncSource: { type: String, default: 'shopify' },
  syncedAt: Date
}, { timestamps: true });

productSchema.index({ category: 1, inStock: 1, price: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

export default mongoose.model('Product', productSchema);
