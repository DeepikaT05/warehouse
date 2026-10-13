const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, trim: true },
  purchaseDate: { type: Date, default: Date.now },
  manufacturer: { type: String, required: true, trim: true },
  invoiceDate: { type: Date, default: Date.now },
  transport: { type: String, default: '' },
  lrNumber: { type: String, default: '' },
  productName: { type: String, required: true },
  technicalName: { type: String, default: '' },
  hsnCode: { type: String, default: '' },
  category: { type: String, default: 'Crop Protection' },
  batchNumber: { type: String, required: true },
  packing: { type: String, default: null },
  packingSize: { type: String, default: null },
  unit: { type: String, default: 'kg' },
  quantity: { type: Number, required: true, min: 1 },
  cases: { type: Number, default: 1 },
  conversion: { type: Number, default: 0 }, // Pieces per Peti from Tally CONVERSION
  alternateUnit: { type: String, default: 'BOX' },
  unitSize: { type: String, default: '' },
  casePacking: { type: String, default: '' },
  weight: { type: String, default: null },
  purchaseCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  costUnit: { type: String, default: 'box' },
  costRate: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 },
  mfgDate: { type: Date, default: Date.now },
  expDate: { type: Date, default: null },
  billFileUrl: { type: String, default: '' },
  warehouseLocation: { type: String, default: 'RAIPUR GODOWN' },
  remarks: { type: String, default: '' },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'barcode_pending', 'barcode_generated', 'sticker_printed', 'stock_verified'],
    default: 'submitted'
  },
  isLocked: { type: Boolean, default: true },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    set: v => (v && mongoose.Types.ObjectId.isValid(v) ? v : undefined)
  },
  tallySyncStatus: {
    type: String,
    enum: ['synced', 'pending', 'failed', 'local_only'],
    default: 'pending'
  },
  tallyVoucherNumber: { type: String, default: '' },
  tallyGuid: { type: String, default: '' },
  tallySyncError: { type: String, default: '' },
  tallySyncedAt: { type: Date, default: null },
  enteredByUsername: { type: String, default: 'warehouse1' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Query indexes (list/filter/dashboard hot paths)
purchaseSchema.index({ isDeleted: 1, createdAt: -1 });
purchaseSchema.index({ isDeleted: 1, status: 1 });
purchaseSchema.index({ invoiceNumber: 1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
