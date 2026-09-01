const StockBox = require('../models/StockBox');
const AuditLog = require('../models/AuditLog');

function escapeRegex(text) {
  return String(text).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// Module 5: Stock Management & Filtering
const getStockBoxes = async (req, res) => {
  try {
    const { product, batch, manufacturer, status, rack, search, purchaseInvoice, date, startDate, endDate } = req.query;
    const filter = { isDeleted: { $ne: true } };

    if (product) filter.productName = { $regex: escapeRegex(product), $options: 'i' };
    if (batch) filter.batchNumber = { $regex: escapeRegex(batch), $options: 'i' };
    if (manufacturer) filter.manufacturer = { $regex: escapeRegex(manufacturer), $options: 'i' };
    if (status) filter.status = status;
    if (rack) filter.warehouseLocation = { $regex: escapeRegex(rack), $options: 'i' };
    if (purchaseInvoice) filter.purchaseInvoice = { $regex: escapeRegex(purchaseInvoice), $options: 'i' };

    if (date) {
      const d = new Date(date);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    } else if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = e;
      }
    }

    if (search && search.trim()) {
      const cleanSearch = escapeRegex(search.trim());
      filter.$or = [
        { qrId: { $regex: cleanSearch, $options: 'i' } },
        { barcode: { $regex: cleanSearch, $options: 'i' } },
        { productName: { $regex: cleanSearch, $options: 'i' } },
        { batchNumber: { $regex: cleanSearch, $options: 'i' } },
        { purchaseInvoice: { $regex: cleanSearch, $options: 'i' } }
      ];
    }

    const boxes = await StockBox.find(filter).sort({ createdAt: -1 });
    
    // Calculate aggregate metrics
    const total = await StockBox.countDocuments({ isDeleted: { $ne: true } });
    const available = await StockBox.countDocuments({ status: 'available', isDeleted: { $ne: true } });
    const reserved = await StockBox.countDocuments({ status: 'reserved', isDeleted: { $ne: true } });
    const dispatched = await StockBox.countDocuments({ status: 'dispatched', isDeleted: { $ne: true } });
    const returned = await StockBox.countDocuments({ status: 'returned', isDeleted: { $ne: true } });

    return res.json({
      success: true,
      boxes,
      summary: { total, available, reserved, dispatched, returned }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Module 11: Product Lifecycle History
const getBoxByQrId = async (req, res) => {
  try {
    const qrId = req.params.qrId.trim().toUpperCase();
    const box = await StockBox.findOne({ 
      $or: [{ qrId: qrId }, { barcode: qrId }] 
    }).populate('assignedDealerId');

    if (!box) {
      return res.status(404).json({ 
        success: false, 
        message: `No inventory record found for QR / Barcode ID '${qrId}'.` 
      });
    }

    return res.json({ success: true, box });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Update box rack location or info (Admin/Warehouse)
const updateBox = async (req, res) => {
  try {
    const { id } = req.params;
    const { warehouseLocation, status, remarks } = req.body;

    const box = await StockBox.findById(id);
    if (!box) return res.status(404).json({ success: false, message: 'Box not found' });

    if (warehouseLocation && warehouseLocation !== box.warehouseLocation) {
      box.history.push({
        stage: 'Stock Relocated',
        title: 'Rack Movement',
        description: `Moved from ${box.warehouseLocation} to ${warehouseLocation}`,
        performedBy: req.user?.name || 'Operator',
        timestamp: new Date()
      });
      box.warehouseLocation = warehouseLocation;
    }

    if (status && status !== box.status) {
      box.history.push({
        stage: 'Status Change',
        title: `Status set to ${status.toUpperCase()}`,
        description: remarks || `Status changed from ${box.status} to ${status}`,
        performedBy: req.user?.name || 'Operator',
        timestamp: new Date()
      });
      box.status = status;
    }

    await box.save();

    await AuditLog.create({
      action: 'STOCK_UPDATED',
      user: req.user?.username || 'user',
      role: req.user?.role || 'warehouse',
      details: `Updated Box ${box.qrId}: Rack=${box.warehouseLocation}, Status=${box.status}`
    });

    return res.json({ success: true, message: 'Stock box updated successfully', box });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get Dashboard Summary
const getDashboardMetrics = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const totalStock = await StockBox.countDocuments();
    const availableStock = await StockBox.countDocuments({ status: 'available' });
    const todayPurchases = await StockBox.countDocuments({ createdAt: { $gte: startOfDay } });
    const todayDispatches = await StockBox.countDocuments({ 
      status: 'dispatched', 
      updatedAt: { $gte: startOfDay } 
    });
    const pendingDispatches = await StockBox.countDocuments({ status: 'reserved' });

    const recentBoxes = await StockBox.find().sort({ updatedAt: -1 }).limit(8);

    return res.json({
      success: true,
      metrics: {
        totalStock,
        availableStock,
        todayPurchases,
        todayDispatches,
        pendingDispatches,
        lowStock: availableStock < 50
      },
      recentBoxes
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Delete stock box
const deleteBox = async (req, res) => {
  try {
    const { id } = req.params;
    const box = await StockBox.findByIdAndDelete(id);
    if (!box) return res.status(404).json({ success: false, message: 'Box not found' });

    await AuditLog.create({
      action: 'STOCK_DELETED',
      user: req.user?.username || 'user',
      role: req.user?.role || 'warehouse',
      details: `Deleted Stock Box QR: ${box.qrId}`
    });

    return res.json({ success: true, message: `Box ${box.qrId} deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Delete all stock boxes belonging to a purchase invoice
const deleteInvoiceStock = async (req, res) => {
  try {
    const { invoiceNo } = req.params;
    const result = await StockBox.deleteMany({ purchaseInvoice: invoiceNo });

    await AuditLog.create({
      action: 'INVOICE_STOCK_DELETED',
      user: req.user?.username || 'user',
      role: req.user?.role || 'warehouse',
      details: `Deleted ${result.deletedCount} stock boxes for Purchase Invoice ${invoiceNo}`
    });

    return res.json({
      success: true,
      message: `Deleted ${result.deletedCount} stock boxes for Purchase Invoice ${invoiceNo}.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getStockBoxes, getBoxByQrId, updateBox, getDashboardMetrics, deleteBox, deleteInvoiceStock };
