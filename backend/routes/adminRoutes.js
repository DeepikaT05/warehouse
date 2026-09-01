const express = require('express');
const router = express.Router();
const {
  getUsers,
  createUser,
  updateUserStatus,
  resetUserPassword,
  deleteUser,
  getAuditLogs,
  getSettings,
  updateSettings,
  backupDatabase,
  restoreDatabase,
  deleteStockBox,
  updatePurchase,
  deletePurchase,
  updateStockBox,
  updateDealer,
  deleteDealer,
  updateDispatch,
  deleteDispatch,
  deleteAuditLog,
  updateAuditLog
} = require('../controllers/adminController');
const { verifyToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

// All admin routes require verifyToken and admin role
router.use(verifyToken, requireRoles('admin'));

// User management
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUserStatus);
router.post('/users/:id/reset-password', resetUserPassword);
router.delete('/users/:id', deleteUser);

// Audit logs
router.get('/audit-logs', getAuditLogs);
router.delete('/audit-logs/:id', deleteAuditLog);
router.put('/audit-logs/:id', updateAuditLog);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Backup & Restore
router.get('/backup', backupDatabase);
router.post('/restore', restoreDatabase);

// Inventory admin action
router.delete('/boxes/:id', deleteStockBox);
router.put('/boxes/:id', updateStockBox);

// Master Data actions
router.put('/purchases/:id', updatePurchase);
router.delete('/purchases/:id', deletePurchase);

router.put('/dealers/:id', updateDealer);
router.delete('/dealers/:id', deleteDealer);

router.put('/dispatches/:id', updateDispatch);
router.delete('/dispatches/:id', deleteDispatch);

module.exports = router;
