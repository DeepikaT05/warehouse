const StockBox = require('../models/StockBox');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');

function getPiecesPerPeti(packing) {
  if (!packing) return 10;
  const p = packing.toString().toUpperCase().trim();
  if (p.includes('160 GM') || p.includes('160GM') || p.includes('CURVE')) return 8;
  if (p.includes('1 LTR') || p.includes('1 LT') || p.includes('1 KG') || p.includes('1KG')) return 10;
  if (p.includes('500 ML') || p.includes('500 GM') || p.includes('500GM') || p.includes('500ML')) return 20;
  if (p.includes('250 ML') || p.includes('250 GM') || p.includes('250GM') || p.includes('250ML')) return 40;
  if (p.includes('100 ML') || p.includes('100 GM') || p.includes('100GM') || p.includes('100ML')) return 50;
  if (p.includes('150 ML') || p.includes('200 ML')) return 20;
  if (p.includes('300 ML') || p.includes('300 GM') || p.includes('400 ML') || p.includes('800 ML')) return 20;
  if (p.includes('4 KG') || p.includes('5 KG') || p.includes('4KG') || p.includes('5KG')) return 4;
  if (p.includes('8 GM') || p.includes('15 ML') || p.includes('30 GM') || p.includes('50 GM') || p.includes('75 GM')) return 100;
  return 10;
}

function escapeRegex(text) {
  return String(text).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// Module 5: Stock Management & Filtering
// List is paginated and excludes the (potentially large) history array; the full
// Module 5: Stock Management & Filtering
const LIST_FIELDS = 'qrId barcode productName technicalName manufacturer hsnCode batchNumber packing packingSize unit cases casePacking weight purchaseInvoice purchaseCost totalCost costUnit costRate mfgDate expDate warehouseLocation status conversion';
const MAX_LIMIT = 3000;

const getStockBoxes = async (req, res) => {
  try {
    const { product, batch, packing, manufacturer, status, rack, search, purchaseInvoice, date, startDate, endDate } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    
    // Protect against unbounded limit: 'all' without purchaseInvoice filter
    let defaultLimit = 100;
    if (purchaseInvoice) defaultLimit = 2000;
    else if (search) defaultLimit = 500;

    let requestedLimit = parseInt(req.query.limit, 10);
    if (req.query.limit === 'all') {
      requestedLimit = purchaseInvoice ? 2000 : 500;
    }
    const limit = Math.min(MAX_LIMIT, Math.max(1, requestedLimit || defaultLimit));

    const filter = { isDeleted: { $ne: true } };

    if (product) {
      let cleanProd = escapeRegex(product);
      if (/v[ei]+da|w[ei]+da/i.test(cleanProd)) cleanProd = cleanProd.replace(/v[ei]+da|w[ei]+da/gi, 'v[ei]+da');
      if (/v[ei]+gen|w[ei]+gen/i.test(cleanProd)) cleanProd = cleanProd.replace(/v[ei]+gen|w[ei]+gen/gi, 'v[ei]+gen');
      filter.productName = { $regex: cleanProd, $options: 'i' };
    }
    if (batch) filter.batchNumber = { $regex: escapeRegex(batch), $options: 'i' };
    if (packing) filter.packing = { $regex: escapeRegex(packing), $options: 'i' };
    if (manufacturer) filter.manufacturer = { $regex: escapeRegex(manufacturer), $options: 'i' };
    if (status) filter.status = status;
    if (rack) filter.warehouseLocation = { $regex: escapeRegex(rack), $options: 'i' };
    if (purchaseInvoice) filter.purchaseInvoice = { $regex: escapeRegex(purchaseInvoice), $options: 'i' };

    if (date) {
      const d = new Date(date);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    } else if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) { const st = new Date(startDate); st.setHours(0, 0, 0, 0); filter.createdAt.$gte = st; }
      if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); filter.createdAt.$lte = e; }
    }

    if (search && search.trim()) {
      const rawSearch = search.trim();
      const tokens = rawSearch.split(/\s+/).filter(Boolean).map(t => {
        let esc = escapeRegex(t);
        if (/v[ei]+da|w[ei]+da/i.test(esc)) {
          esc = esc.replace(/v[ei]+da|w[ei]+da/gi, 'v[ei]+da');
        }
        if (/v[ei]+gen|w[ei]+gen/i.test(esc)) {
          esc = esc.replace(/v[ei]+gen|w[ei]+gen/gi, 'v[ei]+gen');
        }
        return esc;
      });

      if (tokens.length <= 1) {
        const pattern = tokens[0] || escapeRegex(rawSearch);
        filter.$or = [
          { qrId: { $regex: pattern, $options: 'i' } },
          { barcode: { $regex: pattern, $options: 'i' } },
          { productName: { $regex: pattern, $options: 'i' } },
          { batchNumber: { $regex: pattern, $options: 'i' } },
          { purchaseInvoice: { $regex: pattern, $options: 'i' } }
        ];
      } else {
        filter.$and = tokens.map(pattern => ({
          $or: [
            { qrId: { $regex: pattern, $options: 'i' } },
            { barcode: { $regex: pattern, $options: 'i' } },
            { productName: { $regex: pattern, $options: 'i' } },
            { batchNumber: { $regex: pattern, $options: 'i' } },
            { purchaseInvoice: { $regex: pattern, $options: 'i' } }
          ]
        }));
      }
    }

    // One grouped aggregation replaces the five sequential countDocuments calls.
    const [boxes, matched, byStatus] = await Promise.all([
      StockBox.find(filter).select(LIST_FIELDS).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      StockBox.countDocuments(filter),
      StockBox.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    const counts = Object.fromEntries(byStatus.map(r => [r._id, r.count]));
    const summary = {
      total: byStatus.reduce((acc, r) => acc + r.count, 0),
      available: counts.available || 0,
      reserved: counts.reserved || 0,
      dispatched: counts.dispatched || 0,
      returned: counts.returned || 0,
      pendingVerification: counts.pending_verification || 0
    };

    return res.json({
      success: true,
      boxes,
      summary,
      pagination: { page, limit, matched, pages: Math.max(1, Math.ceil(matched / limit)) }
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
      $or: [{ qrId }, { barcode: qrId }],
      isDeleted: { $ne: true }
    }).populate('assignedDealerId').lean();

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

    const notDeleted = { isDeleted: { $ne: true } };

    const [totalStock, availableStock, todayPurchases, todayDispatches, pendingDispatches, recentBoxes] = await Promise.all([
      StockBox.countDocuments(notDeleted),
      StockBox.countDocuments({ ...notDeleted, status: 'available' }),
      StockBox.countDocuments({ ...notDeleted, createdAt: { $gte: startOfDay } }),
      StockBox.countDocuments({ ...notDeleted, status: 'dispatched', updatedAt: { $gte: startOfDay } }),
      StockBox.countDocuments({ ...notDeleted, status: 'reserved' }),
      StockBox.find(notDeleted).select('-history').sort({ updatedAt: -1 }).limit(8).lean()
    ]);

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
    const box = await StockBox.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date(), deletedBy: req.user?.username || 'user' },
      { new: true }
    );
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
    const result = await StockBox.updateMany(
      { purchaseInvoice: invoiceNo, isDeleted: { $ne: true } },
      { isDeleted: true, deletedAt: new Date(), deletedBy: req.user?.username || 'user' }
    );

    await AuditLog.create({
      action: 'INVOICE_STOCK_DELETED',
      user: req.user?.username || 'user',
      role: req.user?.role || 'warehouse',
      details: `Deleted ${result.modifiedCount} stock boxes for Purchase Invoice ${invoiceNo}`
    });

    return res.json({
      success: true,
      message: `Deleted ${result.modifiedCount} stock boxes for Purchase Invoice ${invoiceNo}.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getInvoicesSummary = async (req, res) => {
  try {
    const { search, product, batch, manufacturer, status, rack, purchaseInvoice, date, startDate, endDate } = req.query;
    const filter = { isDeleted: { $ne: true } };

    if (purchaseInvoice) filter.purchaseInvoice = { $regex: escapeRegex(purchaseInvoice), $options: 'i' };
    if (product) filter.productName = { $regex: escapeRegex(product), $options: 'i' };
    if (batch) filter.batchNumber = { $regex: escapeRegex(batch), $options: 'i' };
    if (manufacturer) filter.manufacturer = { $regex: escapeRegex(manufacturer), $options: 'i' };
    if (rack) filter.warehouseLocation = { $regex: escapeRegex(rack), $options: 'i' };
    if (status) filter.status = status;

    if (date) {
      const d = new Date(date);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    } else if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) { const st = new Date(startDate); st.setHours(0, 0, 0, 0); filter.createdAt.$gte = st; }
      if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); filter.createdAt.$lte = e; }
    }

    if (search && search.trim()) {
      const clean = escapeRegex(search.trim());
      filter.$or = [
        { qrId: { $regex: clean, $options: 'i' } },
        { barcode: { $regex: clean, $options: 'i' } },
        { productName: { $regex: clean, $options: 'i' } },
        { batchNumber: { $regex: clean, $options: 'i' } },
        { purchaseInvoice: { $regex: clean, $options: 'i' } }
      ];
    }

    const [invoices, summaryByStatus, purchases, products] = await Promise.all([
      StockBox.aggregate([
        { $match: filter },
        {
          $group: {
            _id: {
              purchaseInvoice: '$purchaseInvoice',
              productName: '$productName',
              packing: '$packing',
              batchNumber: '$batchNumber'
            },
            warehouseLocation: { $first: '$warehouseLocation' },
            hsnCode: { $first: '$hsnCode' },
            weight: { $first: '$weight' },
            cases: { $first: '$cases' },
            conversion: { $first: '$conversion' },
            totalBoxes: { $sum: 1 },
            availableBoxes: {
              $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
            },
            dispatchedBoxes: {
              $sum: { $cond: [{ $eq: ['$status', 'dispatched'] }, 1, 0] }
            },
            firstQr: { $first: '$qrId' },
            lastQr: { $last: '$qrId' },
            createdAt: { $first: '$createdAt' }
          }
        },
        { $sort: { createdAt: -1, '_id.purchaseInvoice': -1, '_id.productName': 1 } }
      ]),
      StockBox.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Purchase.find({ isDeleted: { $ne: true } }).select('invoiceNumber productName batchNumber cases quantity packing conversion weight').lean(),
      Product.find({ isDeleted: { $ne: true } }).select('name conversion packingSize').lean()
    ]);

    const purchaseMap = new Map();
    (purchases || []).forEach(p => {
      if (p.invoiceNumber) {
        const inv = p.invoiceNumber.trim().toUpperCase();
        const prod = (p.productName || '').trim().toUpperCase();
        const pack = (p.packing || '').trim().toUpperCase();
        const batch = (p.batchNumber || '').trim().toUpperCase();

        purchaseMap.set(`${inv}__${prod}__${pack}__${batch}`, p);
        purchaseMap.set(`${inv}__${prod}__${batch}`, p);
        purchaseMap.set(`${inv}__${prod}`, p);
        if (!purchaseMap.has(inv)) purchaseMap.set(inv, p);
      }
    });

    const productMap = new Map();
    (products || []).forEach(prod => {
      if (prod.name) {
        productMap.set(prod.name.trim().toUpperCase(), prod);
      }
    });

    const counts = Object.fromEntries(summaryByStatus.map(r => [r._id, r.count]));
    const summary = {
      total: summaryByStatus.reduce((acc, r) => acc + r.count, 0),
      available: counts.available || 0,
      reserved: counts.reserved || 0,
      dispatched: counts.dispatched || 0,
      returned: counts.returned || 0,
      pendingVerification: counts.pending_verification || 0
    };

    let mappedInvoices = invoices.map(inv => {
      const invNo = inv._id.purchaseInvoice || 'Unassigned';
      const pName = inv._id.productName || 'Product';
      const pPack = inv._id.packing || inv.weight || null;
      const pBatch = inv._id.batchNumber || '';

      const fullKey = `${invNo.trim().toUpperCase()}__${pName.trim().toUpperCase()}__${(pPack || '').trim().toUpperCase()}__${pBatch.trim().toUpperCase()}`;
      const pMatch = purchaseMap.get(fullKey)
        || purchaseMap.get(`${invNo.trim().toUpperCase()}__${pName.trim().toUpperCase()}__${pBatch.trim().toUpperCase()}`)
        || purchaseMap.get(`${invNo.trim().toUpperCase()}__${pName.trim().toUpperCase()}`)
        || purchaseMap.get(invNo.trim().toUpperCase());

      const prodMatch = productMap.get(pName.trim().toUpperCase());

      // Official Conversion takes highest priority (1 Peti me kitne pieces/bottles aate hain)
      let pcsPerPeti = 0;
      if (inv.conversion && Number(inv.conversion) > 0) {
        pcsPerPeti = Number(inv.conversion);
      } else if (pMatch && pMatch.conversion && Number(pMatch.conversion) > 0) {
        pcsPerPeti = Number(pMatch.conversion);
      } else if (prodMatch && prodMatch.conversion && Number(prodMatch.conversion) > 0) {
        pcsPerPeti = Number(prodMatch.conversion);
      } else {
        pcsPerPeti = getPiecesPerPeti(pPack || inv.weight);
      }
      if (!pcsPerPeti || pcsPerPeti <= 0) pcsPerPeti = 10;

      const totalInwardedBoxes = Math.max(0, inv.totalBoxes || 0);
      const availableBoxes = Math.max(0, typeof inv.availableBoxes === 'number' ? inv.availableBoxes : totalInwardedBoxes);
      const dispatchedBoxes = Math.max(0, totalInwardedBoxes - availableBoxes);

      // Check if each box represents 1 Peti (Peti-level QR generation)
      const expectedCases = (pMatch && pMatch.cases && Number(pMatch.cases) > 0) ? Number(pMatch.cases) : (Number(inv.cases) || 0);
      const isPetiLevel = expectedCases > 0 && totalInwardedBoxes <= expectedCases;

      let totalInwardedCases, availableCases, fullCases, loosePieces, dispatchedCases, totalPieces, availablePieces, dispatchedPieces;

      if (isPetiLevel) {
        // Each StockBox is 1 Peti! (e.g. 10 boxes = 10 Peti)
        totalInwardedCases = totalInwardedBoxes;
        availableCases = availableBoxes;
        fullCases = availableBoxes;
        loosePieces = 0;
        dispatchedCases = dispatchedBoxes;
        totalPieces = totalInwardedBoxes * pcsPerPeti;
        availablePieces = availableBoxes * pcsPerPeti;
        dispatchedPieces = dispatchedBoxes * pcsPerPeti;
      } else {
        // Legacy Piece-level stock (e.g. 160 bottles = 8 Peti)
        totalInwardedCases = expectedCases > 0 ? expectedCases : Math.max(1, Math.ceil(totalInwardedBoxes / pcsPerPeti));
        fullCases = Math.floor(availableBoxes / pcsPerPeti);
        loosePieces = availableBoxes % pcsPerPeti;
        availableCases = availableBoxes > 0 ? (loosePieces > 0 ? fullCases + 1 : fullCases) : 0;
        dispatchedCases = dispatchedBoxes > 0 ? Math.ceil(dispatchedBoxes / pcsPerPeti) : 0;
        totalPieces = totalInwardedBoxes;
        availablePieces = availableBoxes;
        dispatchedPieces = dispatchedBoxes;
      }

      const finalWeight = (pMatch && pMatch.weight) ? pMatch.weight : (inv.weight || pPack || '');

      // Unique group key for UI accordion and cache
      const groupKey = `${invNo}_${pName}_${pPack}_${pBatch}`.replace(/[^a-zA-Z0-9_-]/g, '_');

      return {
        _id: groupKey,
        groupKey,
        invoiceNo: invNo,
        productName: pName,
        batchNumber: pBatch,
        packing: pPack,
        weight: finalWeight,
        warehouseLocation: inv.warehouseLocation || 'FACTORY GODOWN',
        hsnCode: inv.hsnCode || '38089910',
        totalBoxes: totalInwardedBoxes,
        totalPieces,
        availableBoxes,
        availablePieces,
        dispatchedBoxes,
        dispatchedPieces,
        totalInwardedCases,
        totalCases: totalInwardedCases,
        availableCases,
        fullCases,
        loosePieces,
        dispatchedCases,
        cases: availableCases,
        petiCount: availableCases,
        isPetiLevel,
        conversion: pcsPerPeti,
        pcsPerPeti,
        firstQr: inv.firstQr,
        lastQr: inv.lastQr
      };
    });

    // Guard against 0 or negative items
    mappedInvoices = mappedInvoices.filter(inv => inv.totalBoxes > 0);

    // If filtering by available status, hide items with 0 available stock
    if (status === 'available') {
      mappedInvoices = mappedInvoices.filter(inv => inv.availablePieces > 0);
    } else if (status === 'dispatched') {
      mappedInvoices = mappedInvoices.filter(inv => inv.dispatchedPieces > 0);
    }

    return res.json({
      success: true,
      invoices: mappedInvoices,
      summary
    });
  } catch (err) {
    console.error('getInvoicesSummary error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getStockBoxes, getBoxByQrId, updateBox, getDashboardMetrics, deleteBox, deleteInvoiceStock, getInvoicesSummary };
