const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const { createPurchase, getPurchases, getPurchaseById, extractPurchaseOcr, downloadPurchasePdf } = require('../controllers/purchaseController');
const { getTallyStatus, syncFromTally, pushToTally, uploadTallyFile, syncTallyXml } = require('../controllers/tallyPurchaseController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// Tally Integration Endpoints
router.get('/tally/status', getTallyStatus);
router.post('/tally/sync', syncFromTally);
router.post('/tally/sync-xml', syncTallyXml);
router.post('/tally/upload-file', upload.single('tallyFile'), uploadTallyFile);
router.post('/tally/push/:id', pushToTally);

// Goods inward routes
router.get('/', getPurchases);
router.get('/:id', getPurchaseById);
router.get('/:id/pdf', downloadPurchasePdf);
router.post('/', createPurchase);
router.post('/ocr-extract', upload.single('billFile'), extractPurchaseOcr);

module.exports = router;
