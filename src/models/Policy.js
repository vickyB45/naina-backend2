import mongoose from 'mongoose';

const policySchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    enum: ['shipping', 'return', 'cod', 'contact']
  },
  title: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Policy', policySchema);
