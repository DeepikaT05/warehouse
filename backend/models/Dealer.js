const mongoose = require('mongoose');

const dealerSchema = new mongoose.Schema({
  dealerName: { type: String, required: true, trim: true },
  garageName: { type: String, required: true, trim: true },
  ownerName: { type: String, default: '' },
  gstNumber: { type: String, default: '' },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  address: { type: String, required: true },
  state: { type: String, required: true },
  district: { type: String, required: true },
  city: { type: String, required: true },
  pincode: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Dealer', dealerSchema);
