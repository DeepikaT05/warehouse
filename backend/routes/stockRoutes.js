const express = require('express');
const router = express.Router();
const { getStockBoxes, getBoxByQrId, updateBox, getDashboardMetrics, deleteBox, deleteInvoiceStock, getInvoicesSummary } = require('../controllers/stockController');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

router.use(verifyToken);

router.get('/', getStockBoxes);
router.get('/invoices-summary', getInvoicesSummary);
router.get('/dashboard', getDashboardMetrics);
router.get('/qr/:qrId', getBoxByQrId);
router.put('/:id', requireAdmin, updateBox);
router.delete('/invoice/:invoiceNo', requireAdmin, deleteInvoiceStock);
router.delete('/:id', requireAdmin, deleteBox);

module.exports = router;
