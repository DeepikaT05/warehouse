const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  extractBillOcrData,
  createSalesInvoice,
  getSalesInvoices,
  getInvoiceByNo,
  getWorkersList,
  triggerB2BSync,
  cancelSalesInvoice,
  downloadB2BPdf
} = require('../controllers/invoiceController');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(verifyToken);

router.get('/workers', getWorkersList);
router.get('/', getSalesInvoices);
router.post('/sync-b2b', triggerB2BSync);
router.get('/:id/b2b-pdf', downloadB2BPdf);
router.post('/:id/cancel', cancelSalesInvoice);
router.get('/:invoiceNo', getInvoiceByNo);

router.post('/ocr-extract', requireAdmin, upload.single('billFile'), extractBillOcrData);
router.post('/', requireAdmin, createSalesInvoice);

module.exports = router;

