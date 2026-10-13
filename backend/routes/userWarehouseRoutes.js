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
  getUserDashboardSummary,
  cancelAssignedOrder,
  triggerWarehouseB2BSync
} = require('../controllers/userWarehouseController');
const { verifyToken } = require('../middleware/auth');

// Every warehouse route requires a valid session
router.use(verifyToken);

// Dashboard metrics
router.get('/dashboard-summary', getUserDashboardSummary);

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
router.post('/orders/sync-b2b', triggerWarehouseB2BSync);
router.get('/orders/:id', getOrderById);
router.post('/orders/:id/cancel', cancelAssignedOrder);

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

