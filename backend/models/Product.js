const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productCode: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  technicalName: { type: String, default: '' },
  category: { type: String, required: true, default: 'Crop Protection' },
  unit: { type: String, default: 'kg' },
  packingSize: { type: String, default: null },
  conversion: { type: Number, default: 0 }, // Pieces / Bottles per Peti from Tally (CONVERSION)
  alternateUnit: { type: String, default: 'BOX' }, // Alternate unit in Tally (BOX, PETI, CASE)
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

// Query indexes (list/filter/dashboard hot paths)
productSchema.index({ isDeleted: 1, name: 1 });

module.exports = mongoose.model('Product', productSchema);
