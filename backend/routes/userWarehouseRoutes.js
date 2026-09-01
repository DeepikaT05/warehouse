const express = require('express');
const router = express.Router();
const {
  getPurchases,
  createPurchase,
  getPurchaseById,
  finalizePurchaseSubmit,
  generatePurchaseQrCodes,
  recordStickerPrint,
  getStockBoxes,
  verifyInitialStockScan,
  getAssignedOrders,
  getOrderById,
  startStockPicking,
  scanPickingItem,
  completeStockPicking,
  getVerificationSummary,
  generateDeliveryInvoice,
  markOrderSentToDealer,
  getDealerApprovalStatus,
  getUserDashboardSummary
} = require('../controllers/userWarehouseController');
const { verifyToken } = require('../middleware/auth');

// Dashboard Metrics (Unrestricted Read)
router.get('/dashboard-summary', getUserDashboardSummary);

// All warehouse user routes require verifyToken
router.use(verifyToken);

// Purchases & Inward
router.get('/purchases', getPurchases);
router.post('/purchases', createPurchase);
router.get('/purchases/:id', getPurchaseById);
router.post('/purchases/:id/submit', finalizePurchaseSubmit);

// Barcode & QR Generation & Sticker Printing
router.post('/purchases/:id/generate-codes', generatePurchaseQrCodes);
router.post('/codes/:id/print', recordStickerPrint);

// Stock & Initial Verification
router.get('/stock', getStockBoxes);
router.post('/stock/verify-scan', verifyInitialStockScan);

// Assigned Dealer Bills / Orders
router.get('/orders', getAssignedOrders);
router.get('/orders/:id', getOrderById);

// Stock Picking Workflow
router.post('/orders/:id/start-picking', startStockPicking);
router.post('/orders/:id/scan-item', scanPickingItem);
router.post('/orders/:id/complete-picking', completeStockPicking);

// Verification & Delivery Invoice
router.get('/orders/:id/verification-summary', getVerificationSummary);
router.post('/orders/:id/generate-delivery-invoice', generateDeliveryInvoice);
router.post('/orders/:id/mark-sent', markOrderSentToDealer);

// Dealer Approval & Bilty Tracking
router.get('/orders/:id/dealer-approval-status', getDealerApprovalStatus);

module.exports = router;
