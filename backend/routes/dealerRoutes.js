const express = require('express');
const router = express.Router();
const { createDealer, getDealers, updateDealer, deleteDealer } = require('../controllers/dealerController');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

router.use(verifyToken);

router.get('/', getDealers);
router.post('/', requireAdmin, createDealer);
router.put('/:id', requireAdmin, updateDealer);
router.delete('/:id', requireAdmin, deleteDealer);

module.exports = router;
