const mongoose = require('mongoose');

const historyItemSchema = new mongoose.Schema({
  stage: { type: String, required: true }, // e.g. 'Purchase Received', 'QR Generated', 'Sticker Printed', 'Stock Verified', 'Stock Picking', 'Invoice Assigned', 'Dispatched', 'Delivered'
  title: { type: String, required: true },
  description: { type: String, default: '' },
  performedBy: { type: String, default: 'Warehouse User' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const stockBoxSchema = new mongoose.Schema({
  qrId: { type: String, required: true, unique: true, index: true }, // VNK-00000001
  barcode: { type: String, required: true },
  purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
  productName: { type: String, required: true },
  manufacturer: { type: String, required: true },
  batchNumber: { type: String, required: true },
  weight: { type: String, default: '1 kg' },
  hsnCode: { type: String, default: '' },
  packing: { type: String, default: '1 kg' },
  cases: { type: Number, default: 1 },
  casePacking: { type: String, default: '' },
  purchaseInvoice: { type: String, required: true },
  purchaseCost: { type: Number, default: 0 },
  category: { type: String, default: 'Crop Protection' },
  unit: { type: String, default: 'kg' },
  packingSize: { type: String, default: '1 kg' },
  mrp: { type: Number, default: 0 },
  mfgDate: { type: Date, default: Date.now },
  expDate: { type: Date, default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
  warehouseLocation: { type: String, default: 'Rack A1' },
  stickerStatus: {
    type: String,
    enum: ['not_printed', 'printed', 'reprinted'],
    default: 'not_printed'
  },
  printCount: { type: Number, default: 0 },
  verificationStatus: {
    type: String,
    enum: ['pending_verification', 'verified', 'issue_found', 'rejected'],
    default: 'pending_verification'
  },
  status: { 
    type: String, 
    enum: ['pending_verification', 'available', 'reserved', 'dispatched', 'returned', 'issue_found', 'rejected'], 
    default: 'available' 
  },
  assignedInvoiceNo: { type: String, default: null },
  assignedDealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', default: null },
  dispatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispatch', default: null },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null },
  history: [historyItemSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

stockBoxSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('StockBox', stockBoxSchema);
