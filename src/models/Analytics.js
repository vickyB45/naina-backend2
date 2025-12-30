import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  
  // Conversation Metrics
  totalChats: { type: Number, default: 0 },
  completedChats: { type: Number, default: 0 },
  abandonedChats: { type: Number, default: 0 },
  
  // Intent Distribution
  highIntentChats: { type: Number, default: 0 },
  mediumIntentChats: { type: Number, default: 0 },
  lowIntentChats: { type: Number, default: 0 },
  
  // Stage Distribution
  stageBreakdown: {
    hook: { type: Number, default: 0 },
    engage: { type: Number, default: 0 },
    confirm: { type: Number, default: 0 },
    recommend: { type: Number, default: 0 },
    convert: { type: Number, default: 0 },
    support: { type: Number, default: 0 }
  },
  
  // Conversion Metrics
  totalConversions: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  averageOrderValue: { type: Number, default: 0 },
  conversionRate: { type: Number, default: 0 },
  
  // Product Metrics
  productsViewed: { type: Number, default: 0 },
  productsRecommended: { type: Number, default: 0 },
  
  // AI Performance
  aiModel: { type: String, enum: ['groq', 'gemini'] },
  averageResponseTime: { type: Number, default: 0 },
  totalAIMessages: { type: Number, default: 0 },
  
  createdAt: { type: Date, default: Date.now }
});

analyticsSchema.index({ tenantId: 1, date: -1 });

export default mongoose.model('Analytics', analyticsSchema);
