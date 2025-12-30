import mongoose from "mongoose";

const ProductMetaSchema = new mongoose.Schema({
  productTypes: { type: Object, default: {} },
  nonEthnicItems: { type: [String], default: [] },
  colors: { type: [String], default: [] },
  occasions: { type: [String], default: [] }
}, { timestamps: true });

export default mongoose.models.ProductMeta || mongoose.model("ProductMeta", ProductMetaSchema);