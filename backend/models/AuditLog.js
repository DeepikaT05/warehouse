const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  user: { type: String, required: true },
  role: { type: String, required: true },
  module: { type: String, default: 'General' },
  details: { type: String, default: '' },
  targetId: { type: String, default: '' },
  recordId: { type: String, default: '' },
  ipAddress: { type: String, default: '127.0.0.1' },
  timestamp: { type: Date, default: Date.now }
});


module.exports = mongoose.model('AuditLog', auditLogSchema);
