const express = require('express');
const router = express.Router();
const { createDealer, getDealers, updateDealer, deleteDealer } = require('../controllers/dealerController');
const { verifyToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

router.post('/', verifyToken, requireRoles('sales', 'admin'), createDealer);
router.get('/', verifyToken, getDealers);
router.put('/:id', verifyToken, requireRoles('sales', 'admin'), updateDealer);
router.delete('/:id', verifyToken, requireRoles('admin'), deleteDealer);

module.exports = router;
