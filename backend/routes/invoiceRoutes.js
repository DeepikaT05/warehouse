const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  extractBillOcrData,
  createSalesInvoice,
  getSalesInvoices,
  getInvoiceByNo,
  getWorkersList
} = require('../controllers/invoiceController');
const { verifyToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/ocr-extract', verifyToken, upload.single('billFile'), extractBillOcrData);
router.get('/workers', verifyToken, getWorkersList);

router.post('/', verifyToken, requireRoles('sales', 'admin'), createSalesInvoice);
router.get('/', verifyToken, getSalesInvoices);
router.get('/:invoiceNo', verifyToken, getInvoiceByNo);

module.exports = router;

