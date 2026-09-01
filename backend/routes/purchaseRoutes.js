const express = require('express');
const router = express.Router();
const { createPurchase, getPurchases, getPurchaseById } = require('../controllers/purchaseController');
const { verifyToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

router.post('/', verifyToken, requireRoles('warehouse', 'admin'), createPurchase);
router.get('/', verifyToken, getPurchases);
router.get('/:id', verifyToken, getPurchaseById);

module.exports = router;
