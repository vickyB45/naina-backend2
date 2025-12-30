import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  tenantId: { type: String, unique: true, required: true },
  brandName: { type: String, required: true },
  contactEmail: { type: String, required: true },
  contactName: String,
  domain: String,
  apiKey: { type: String, unique: true, required: true },
  
  plan: { type: String, enum: ['trial', 'basic', 'pro'], default: 'trial' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  
  brandConfig: {
    primaryColor: { type: String, default: '#9333ea' },
    chatbotName: { type: String, default: 'Naina' }
  },
  
  allowedModels: [{ type: String, enum: ['groq', 'gemini'] }],
  
  stats: {
    totalChats: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalConversions: { type: Number, default: 0 }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Tenant', tenantSchema);
