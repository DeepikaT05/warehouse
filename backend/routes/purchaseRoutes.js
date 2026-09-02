const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const { createPurchase, getPurchases, getPurchaseById, extractPurchaseOcr } = require('../controllers/purchaseController');
const { verifyToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

router.post('/', verifyToken, requireRoles('warehouse', 'admin'), createPurchase);
router.post('/ocr-extract', verifyToken, upload.single('billFile'), extractPurchaseOcr);
router.get('/', verifyToken, getPurchases);
router.get('/:id', verifyToken, getPurchaseById);

module.exports = router;

