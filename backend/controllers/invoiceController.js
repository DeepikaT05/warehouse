const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const AuditLog = require('../models/AuditLog');

// Import / Create Sales Invoice
const createSalesInvoice = async (req, res) => {
  try {
    const { invoiceNo, orderId, dealerId, invoiceDate, items } = req.body;

    if (!invoiceNo || !dealerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide Invoice Number, Dealer ID, and Product Items.' });
    }

    const dealer = await Dealer.findById(dealerId);
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'Selected dealer not found in master database.' });
    }

    const existing = await SalesInvoice.findOne({ invoiceNo: invoiceNo.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: `Sales invoice #${invoiceNo} already exists!` });
    }

    const salesInvoice = await SalesInvoice.create({
      invoiceNo: invoiceNo.trim(),
      orderId: orderId || `ORD-${Date.now().toString().slice(-6)}`,
      dealerId: dealer._id,
      dealerName: dealer.dealerName,
      garageName: dealer.garageName,
      invoiceDate: invoiceDate || Date.now(),
      items,
      uploadedBy: req.user?.id
    });

    await AuditLog.create({
      action: 'INVOICE_UPLOADED',
      user: req.user?.username || 'sales',
      role: req.user?.role || 'sales',
      details: `Imported Sales Invoice #${invoiceNo} for ${dealer.dealerName} (${dealer.garageName})`
    });

    return res.status(201).json({
      success: true,
      message: `Sales Invoice #${invoiceNo} imported successfully!`,
      salesInvoice
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getSalesInvoices = async (req, res) => {
  try {
    const invoices = await SalesInvoice.find().sort({ createdAt: -1 }).populate('dealerId');
    return res.json({ success: true, invoices });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getInvoiceByNo = async (req, res) => {
  try {
    const invoice = await SalesInvoice.findOne({ invoiceNo: req.params.invoiceNo }).populate('dealerId');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    return res.json({ success: true, invoice });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createSalesInvoice, getSalesInvoices, getInvoiceByNo };
