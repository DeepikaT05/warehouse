const express = require('express');
const router = express.Router();
const {
  verifyBoxScan,
  confirmDispatch,
  uploadDispatchPhoto,
  downloadDeliveryStatementPdf,
  getDispatches,
  approveDispatch,
  cancelDispatch,
  trackDeliveryByInvoice
} = require('../controllers/dispatchController');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

// 1. Dedicated Tracking Endpoint for StaffTrack and External Apps
// Supports lookup by invoice number (e.g., /api/dispatches/track/273)
// Allows optional Bearer token or x-access-token if provided
router.get('/track/:invoiceNo', (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7).trim()
    : (req.headers['x-access-token'] || req.query.token);
  if (token) {
    return verifyToken(req, res, next);
  }
  return next();
}, trackDeliveryByInvoice);

// 2. Delivery Statement PDF (supports token via query or header)
router.get('/:id/pdf', (req, res, next) => {
  const token = req.headers.authorization || req.headers['x-access-token'] || req.query.token;
  if (token) {
    return verifyToken(req, res, next);
  }
  return next();
}, downloadDeliveryStatementPdf);

// 3. Protected Operations (Require Login / JWT Token)
router.use(verifyToken);

router.get('/', getDispatches);
router.post('/verify-scan', verifyBoxScan);
router.post('/confirm', confirmDispatch);
router.post('/upload-photo', uploadDispatchPhoto);
router.post('/:id/approve', requireAdmin, approveDispatch);
router.post('/:id/cancel', requireAdmin, cancelDispatch);

module.exports = router;
