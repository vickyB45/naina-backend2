import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: String,
  content: String,
  time: { type: Date, default: Date.now }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  messages: [messageSchema],
  attributes: { type: Object, default: {} },
  
  visitorInfo: {
    ipAddress: String,
    userAgent: String,
    browser: String,
    device: String,
    os: String,
    firstVisit: { type: Date, default: Date.now },
    lastVisit: { type: Date, default: Date.now },
    totalMessages: { type: Number, default: 0 },
    pageUrl: String
  },
  
  productsViewed: [String],
  totalProductsShown: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
  
}, { timestamps: true });

conversationSchema.index({ 'visitorInfo.ipAddress': 1 });
conversationSchema.index({ updatedAt: -1 });

export default mongoose.model('Conversation', conversationSchema);
