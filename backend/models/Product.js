const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productCode: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  technicalName: { type: String, default: '' },
  category: { type: String, required: true, default: 'Crop Protection' },
  unit: { type: String, default: 'kg' },
  packingSize: { type: String, default: '1 kg' },
  mrp: { type: Number, default: 0 },
  minStockThreshold: { type: Number, default: 20 },
  description: { type: String, default: '' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Product', productSchema);
