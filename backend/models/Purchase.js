const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, trim: true },
  purchaseDate: { type: Date, default: Date.now },
  manufacturer: { type: String, required: true, trim: true },
  invoiceDate: { type: Date, default: Date.now },
  transport: { type: String, default: '' },
  lrNumber: { type: String, default: '' },
  productName: { type: String, required: true },
  hsnCode: { type: String, default: '' },
  category: { type: String, default: 'Crop Protection' },
  batchNumber: { type: String, required: true },
  packing: { type: String, default: '1 kg' },
  packingSize: { type: String, default: '1 kg' },
  unit: { type: String, default: 'kg' },
  quantity: { type: Number, required: true, min: 1 },
  cases: { type: Number, default: 1 },
  unitSize: { type: String, default: '' },
  casePacking: { type: String, default: '' },
  weight: { type: String, default: '1 kg' },
  purchaseCost: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 },
  mfgDate: { type: Date, default: Date.now },
  expDate: { type: Date, default: null },
  billFileUrl: { type: String, default: '' },
  remarks: { type: String, default: '' },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'barcode_pending', 'barcode_generated', 'sticker_printed', 'stock_verified'],
    default: 'submitted'
  },
  isLocked: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  enteredByUsername: { type: String, default: 'warehouse1' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Purchase', purchaseSchema);
