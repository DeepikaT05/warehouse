const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  companyName: { type: String, default: 'Vaniki Crop Science' },
  address: { type: String, default: 'Plot 42, Industrial Area, Sector 3, Gujarat, India' },
  contactPhone: { type: String, default: '+91 98765 43210' },
  contactEmail: { type: String, default: 'operations@vanikicrop.com' },
  gstNo: { type: String, default: '24AAAAA0000A1Z5' },
  lowStockThreshold: { type: Number, default: 20 },
  qrPrefix: { type: String, default: 'VNK' },
  sessionTimeoutMinutes: { type: Number, default: 30 },
  dispatchApprovalRequired: { type: Boolean, default: false },
  twoFactorEnabledAdmin: { type: Boolean, default: false },
  updatedBy: { type: String, default: 'admin' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Settings', settingsSchema);
