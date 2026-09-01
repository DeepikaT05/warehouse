const express = require('express');
const router = express.Router();
const {
  verifyBoxScan,
  confirmDispatch,
  uploadDispatchPhoto,
  downloadDeliveryStatementPdf,
  getDispatches,
  approveDispatch,
  cancelDispatch
} = require('../controllers/dispatchController');
const { verifyToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

router.post('/verify-scan', verifyToken, verifyBoxScan);
router.post('/confirm', verifyToken, confirmDispatch);
router.post('/upload-photo', verifyToken, uploadDispatchPhoto);
router.get('/', verifyToken, getDispatches);
router.get('/:id/pdf', downloadDeliveryStatementPdf);
router.post('/:id/approve', verifyToken, requireRoles('admin'), approveDispatch);
router.post('/:id/cancel', verifyToken, requireRoles('admin'), cancelDispatch);

module.exports = router;
