const express = require('express');
const router = express.Router();
const { createSalesInvoice, getSalesInvoices, getInvoiceByNo } = require('../controllers/invoiceController');
const { verifyToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

router.post('/', verifyToken, requireRoles('sales', 'admin'), createSalesInvoice);
router.get('/', verifyToken, getSalesInvoices);
router.get('/:invoiceNo', verifyToken, getInvoiceByNo);

module.exports = router;
