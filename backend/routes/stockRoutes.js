const express = require('express');
const router = express.Router();
const { getStockBoxes, getBoxByQrId, updateBox, getDashboardMetrics, deleteBox, deleteInvoiceStock } = require('../controllers/stockController');
const { verifyToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

router.get('/', verifyToken, getStockBoxes);
router.get('/dashboard', getDashboardMetrics);
router.get('/qr/:qrId', verifyToken, getBoxByQrId);
router.put('/:id', verifyToken, requireRoles('warehouse', 'admin'), updateBox);
router.delete('/invoice/:invoiceNo', verifyToken, deleteInvoiceStock);
router.delete('/:id', verifyToken, deleteBox);

module.exports = router;
