const mongoose = require('mongoose');

const dispatchSchema = new mongoose.Schema({
  dispatchNo: { type: String, required: true, unique: true },
  salesInvoiceNo: { type: String, required: true },
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true },
  scannedBoxQrIds: [{ type: String }],
  courierName: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  driverName: { type: String, required: true },
  driverMobile: { type: String, required: true },
  deliveryDate: { type: Date, required: true },
  expectedDelivery: { type: Date, default: Date.now },
  remarks: { type: String, default: '' },
  verifiedBy: { type: String, required: true },
  handoverTo: { type: String, default: '' },
  dispatchPhotoUrl: { type: String, default: '' },
  dispatchPhotoUploadedAt: { type: Date, default: null },
  status: { type: String, enum: ['verified', 'dispatched', 'delivered'], default: 'dispatched' },
  dispatchDate: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Dispatch', dispatchSchema);
