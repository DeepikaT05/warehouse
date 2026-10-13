const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  batchNumber: { type: String, required: true },
  quantity: { type: Number, required: true },
  weight: { type: String, default: '1 kg' },
  hsnCode: { type: String, default: '' },
  price: { type: Number, default: 0 },
  taxRate: { type: Number, default: 18 },
  total: { type: Number, default: 0 }
}, { _id: false });

const pickedItemSchema = new mongoose.Schema({
  qrId: { type: String, required: true },
  barcode: { type: String, default: '' },
  productName: { type: String, required: true },
  batchNumber: { type: String, required: true },
  weight: { type: String, default: '1 kg' },
  scannedAt: { type: Date, default: Date.now },
  scannedBy: { type: String, default: 'Warehouse User' }
}, { _id: false });

const failedScanLogSchema = new mongoose.Schema({
  barcode: { type: String, default: '' },
  errorReason: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const salesInvoiceSchema = new mongoose.Schema({
  invoiceNo: { type: String, required: true, unique: true, trim: true },
  orderId: { type: String, default: '' },
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  dealerName: { type: String, required: true },
  garageName: { type: String, default: '' },
  dealerAddress: { type: String, default: '' },
  dealerPhone: { type: String, default: '' },
  dealerGst: { type: String, default: '' },
  invoiceDate: { type: Date, default: Date.now },
  items: [invoiceItemSchema],
  pickedItems: [pickedItemSchema],
  failedScanLogs: [failedScanLogSchema],
  scannedCount: { type: Number, default: 0 },
  assignedToUser: { type: String, default: 'warehouse1' },
  orderStatus: {
    type: String,
    enum: [
      'new',
      'viewed',
      'picking_started',
      'picking_completed',
      'warehouse_verified',
      'invoice_generated',
      'sent_to_dealer',
      'dealer_approved',
      'completed',
      'rejected',
      'cancelled'
    ],
    default: 'new'
  },
  status: {
    type: String,
    enum: ['pending', 'partially_dispatched', 'verified', 'dispatched', 'completed', 'rejected', 'cancelled'],
    default: 'pending'
  },

  // Central B2B Integration Fields
  centralInvoiceId: { type: String, default: '' },
  centralStoreId: { type: String, default: '' },
  buyerOrderNo: { type: String, default: '' },
  buyerOrderDate: { type: Date, default: null },
  dispatchDocNo: { type: String, default: '' },
  despatchedThrough: { type: String, default: '' },
  destination: { type: String, default: '' },
  termsOfDelivery: { type: String, default: '' },
  paymentTerms: { type: String, default: '' },
  paymentStatus: { type: String, default: 'unpaid' },
  tallySyncStatus: { type: String, default: 'pending' },
  subtotal: { type: Number, default: 0 },
  totalTaxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  source: { type: String, default: 'warehouse' }, // 'warehouse' | 'b2b_portal'
  isB2BOrder: { type: Boolean, default: false },
  b2bPdfUrl: { type: String, default: '' },
  b2bXmlUrl: { type: String, default: '' },

  // Rejection & Cancellation Tracking
  isRejected: { type: Boolean, default: false },
  isCancelled: { type: Boolean, default: false },
  rejectionReason: { type: String, default: '' },
  rejectedAt: { type: Date, default: null },
  rejectedBy: { type: String, default: '' },
  cancellationReason: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: '' },

  billFileUrl: { type: String, default: '' },
  deliveryInvoiceNo: { type: String, default: '' },
  transportName: { type: String, default: '' },
  vehicleNumber: { type: String, default: '' },
  driverName: { type: String, default: '' },
  driverPhone: { type: String, default: '' },
  lrNumber: { type: String, default: '' },
  dispatchedAt: { type: Date, default: null },
  dealerApproved: { type: Boolean, default: false },
  dealerApprovedAt: { type: Date, default: null },
  biltyUploaded: { type: Boolean, default: false },
  biltyUrl: { type: String, default: '' },
  biltyUploadedAt: { type: Date, default: null },
  dispatchPhotoUrl: { type: String, default: '' },
  dispatchPhotoUploadedAt: { type: Date, default: null },
  dealerRemarks: { type: String, default: '' },
  uploadedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    set: v => (v && mongoose.Types.ObjectId.isValid(v) ? v : undefined)
  },
  createdAt: { type: Date, default: Date.now }
});

// Query indexes (list/filter/dashboard hot paths)
salesInvoiceSchema.index({ orderStatus: 1, createdAt: -1 });
salesInvoiceSchema.index({ status: 1, createdAt: -1 });
salesInvoiceSchema.index({ assignedToUser: 1 });
salesInvoiceSchema.index({ dealerId: 1 });
salesInvoiceSchema.index({ centralInvoiceId: 1 });
salesInvoiceSchema.index({ isB2BOrder: 1 });

module.exports = mongoose.model('SalesInvoice', salesInvoiceSchema);
