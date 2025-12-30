import mongoose from 'mongoose';

const policySchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['cod', 'returns', 'delivery', 'sizing'],
    required: true 
  },
  content: String,
  quickReply: String
});

export default mongoose.model('BrandPolicy', policySchema);
