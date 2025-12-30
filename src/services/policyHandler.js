import BrandPolicy from '../models/BrandPolicy.js';

export async function handleObjection(message) {
  const msg = message.toLowerCase();
  
  if (msg.includes('cod') || msg.includes('cash on delivery')) {
    const policy = await BrandPolicy.findOne({ type: 'cod' });
    return policy ? policy.quickReply : "Yes! Cash on Delivery is available. ₹40 charge applies. 💵";
  }
  
  if (msg.includes('return') || msg.includes('exchange')) {
    const policy = await BrandPolicy.findOne({ type: 'returns' });
    return policy ? policy.quickReply : "Easy 7-day returns! Keep tags on and item unused. 🔄";
  }
  
  if (msg.includes('delivery') || msg.includes('shipping') || msg.includes('days')) {
    const policy = await BrandPolicy.findOne({ type: 'delivery' });
    return policy ? policy.quickReply : "Delivery in 3-5 days to most cities. Free on orders above ₹999! 📦";
  }
  
  if (msg.includes('size') || msg.includes('fit')) {
    const policy = await BrandPolicy.findOne({ type: 'sizing' });
    return policy ? policy.quickReply : "Check our size guide! Most customers go with their regular size. 📏";
  }
  
  return null;
}
