const StockBox = require('../models/StockBox');
const Purchase = require('../models/Purchase');
const Dispatch = require('../models/Dispatch');
const AuditLog = require('../models/AuditLog');
const Dealer = require('../models/Dealer');
const Product = require('../models/Product');

const getReportsSummary = async (req, res) => {
  try {
    const userRole = req.user?.role?.toLowerCase() === 'admin' ? 'admin' : 'user';

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      stockSummary,
      categoryStock,
      dealerDispatches,
      deletedBoxes,
      recentAuditLogs,
      totalPurchases,
      totalDispatches,
      totalStockUnits,
      availableStock,
      todayPurchases,
      todayDispatches,
      myDeliveryStatements
    ] = await Promise.all([
      StockBox.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      StockBox.aggregate([
        { $match: { isDeleted: { $ne: true }, status: 'available' } },
        { $group: { _id: '$category', total: { $sum: 1 } } }
      ]),
      Dispatch.aggregate([
        { $group: { _id: '$dealerId', totalDispatches: { $sum: 1 } } }
      ]),
      StockBox.find({ isDeleted: true }).select('-history').sort({ deletedAt: -1 }).limit(50).lean(),
      AuditLog.find().sort({ timestamp: -1 }).limit(50).lean(),
      Purchase.countDocuments({ isDeleted: { $ne: true } }),
      Dispatch.countDocuments(),
      StockBox.countDocuments({ isDeleted: { $ne: true } }),
      StockBox.countDocuments({ status: 'available', isDeleted: { $ne: true } }),
      Purchase.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: startOfDay } }),
      Dispatch.countDocuments({ createdAt: { $gte: startOfDay } }),
      Dispatch.find().sort({ createdAt: -1 }).limit(50).populate('dealerId').lean()
    ]);

    return res.json({
      success: true,
      role: userRole,
      reports: {
        stockSummary,
        categoryStock,
        dealerDispatches,
        deletedBoxes,
        recentAuditLogs,
        myDeliveryStatements,
        metrics: {
          totalPurchases,
          totalDispatches,
          totalStockUnits,
          availableStock,
          todayPurchases,
          todayDispatches
        }
      }
    });
  } catch (err) {
    console.error('Reports summary error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getReportsSummary };

