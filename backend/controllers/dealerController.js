const Dealer = require('../models/Dealer');
const AuditLog = require('../models/AuditLog');

const createDealer = async (req, res) => {
  try {
    const { dealerName, garageName, ownerName, gstNumber, phone, email, address, state, district, city, pincode } = req.body;

    if (!dealerName || !garageName || !phone || !address || !state || !district || !city || !pincode) {
      return res.status(400).json({ success: false, message: 'Please provide all mandatory dealer fields.' });
    }

    const dealer = await Dealer.create({
      dealerName,
      garageName,
      ownerName: ownerName || '',
      gstNumber: gstNumber || '',
      phone,
      email: email || '',
      address,
      state,
      district,
      city,
      pincode,
      createdBy: req.user?.id
    });

    await AuditLog.create({
      action: 'DEALER_CREATED',
      user: req.user?.username || 'user',
      role: req.user?.role || 'sales',
      details: `Registered Dealer: ${dealerName} (${garageName})`
    });

    return res.status(201).json({ success: true, message: 'Dealer registered successfully', dealer });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getDealers = async (req, res) => {
  try {
    const dealers = await Dealer.find().sort({ dealerName: 1 });
    return res.json({ success: true, dealers });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateDealer = async (req, res) => {
  try {
    const dealer = await Dealer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!dealer) return res.status(404).json({ success: false, message: 'Dealer not found' });
    return res.json({ success: true, message: 'Dealer updated', dealer });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const deleteDealer = async (req, res) => {
  try {
    await Dealer.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Dealer deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createDealer, getDealers, updateDealer, deleteDealer };
