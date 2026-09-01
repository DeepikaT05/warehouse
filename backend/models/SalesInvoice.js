const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  batchNumber: { type: String, required: true },
  quantity: { type: Number, required: true },
  weight: { type: String, default: '1 kg' }
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
      'completed'
    ],
    default: 'new'
  },
  status: {
    type: String,
    enum: ['pending', 'partially_dispatched', 'verified', 'dispatched', 'completed'],
    default: 'pending'
  },
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
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SalesInvoice', salesInvoiceSchema);
