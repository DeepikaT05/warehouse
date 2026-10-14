const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const StockBox = require('../models/StockBox');
const SalesInvoice = require('../models/SalesInvoice');
const Dispatch = require('../models/Dispatch');
const AuditLog = require('../models/AuditLog');
const Product = require('../models/Product');
const PDFDocument = require('pdfkit');
const { syncB2BInvoices, cancelOrderLocally } = require('../services/b2bSyncService');

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

const normText = (s) => (s || '').toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
const escapeRegexStr = (str) => String(str).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

function extractPackingSize(text) {
  if (!text) return null;
  const s = String(text).toUpperCase().trim();
  
  // Look for liter patterns: e.g. "1 LTR", "1 L", "1LITER"
  const ltrMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:LTR|LITER|L\b)/i);
  if (ltrMatch) {
    const val = parseFloat(ltrMatch[1]);
    return `${val * 1000}ML`;
  }

  // Look for ML patterns: e.g. "500ML", "250 ML"
  const mlMatch = s.match(/(\d+(?:\.\d+)?)\s*ML/i);
  if (mlMatch) {
    return `${parseFloat(mlMatch[1])}ML`;
  }

  // Look for KG patterns: e.g. "1 KG", "5KG"
  const kgMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:KG|KGS)/i);
  if (kgMatch) {
    const val = parseFloat(kgMatch[1]);
    return `${val * 1000}GM`;
  }

  // Look for GM patterns: e.g. "250GM", "266.4 GM"
  const gmMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:GM|GMS|G\b)/i);
  if (gmMatch) {
    return `${parseFloat(gmMatch[1])}GM`;
  }

  return null;
}

function extractBaseProductName(text) {
  if (!text) return '';
  return text
    .replace(/\b\d+(\.\d+)?\s*(ltr|liter|ml|gm|gms|g|l|kg|kgs)\b/gi, '')
    .replace(/\d+l\b/gi, '')
    .replace(/\/\d+/g, '')
    .replace(/\([^\)]*\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function matchProduct(name, code, weight, products) {
  const lineName = normText(name);
  const lineCode = normText(code);
  const itemWeight = normText(weight);

  if (lineCode) {
    const byCode = products.find(p => normText(p.productCode) === lineCode);
    if (byCode) return byCode;
  }

  // Exact match by name AND packing/weight
  if (itemWeight) {
    const byNameAndPack = products.find(p => {
      const pName = normText(p.name);
      const pPack = normText(p.packingSize);
      const nameMatches = pName === lineName || pName.includes(lineName) || lineName.includes(pName);
      const packMatches = pPack === itemWeight || pPack.includes(itemWeight) || itemWeight.includes(pPack) || pName.includes(itemWeight);
      return nameMatches && packMatches;
    });
    if (byNameAndPack) return byNameAndPack;
  }

  // Exact match on name
  const exactName = products.find(p => normText(p.name) === lineName);
  if (exactName) return exactName;

  // Partial match on name
  return products.find(p => {
    const pName = normText(p.name);
    return lineName.includes(pName) || pName.includes(lineName);
  });
}

async function enrichOrdersWithPetis(orders) {
  if (!orders || !orders.length) return orders;
  const products = await Product.find({ isDeleted: { $ne: true } })
    .select('name productCode conversion packingSize')
    .lean();

  return orders.map(order => {
    let orderTotalBoxes = 0;
    let orderTotalPieces = 0;

    const enrichedItems = (order.items || []).map(item => {
      const cleanProdName = (item.productName || '').replace(/\s+/g, ' ').trim();
      const lineName = normText(cleanProdName);
      const matchedProd = matchProduct(cleanProdName, item.productCode, item.weight, products);

      let pcsPerPeti = 10;
      if (matchedProd && Number(matchedProd.conversion) > 0) {
        pcsPerPeti = Number(matchedProd.conversion);
      } else {
        pcsPerPeti = getPiecesPerPeti(item.weight || (matchedProd && matchedProd.packingSize));
      }

      const qty = Number(item.quantity) || 0;
      const totalBoxes = qty > 0 ? Math.ceil(qty / pcsPerPeti) : 0;
      orderTotalBoxes += totalBoxes;
      orderTotalPieces += qty;

      const itemSize = extractPackingSize(cleanProdName) || extractPackingSize(item.weight);
      const pickedBoxes = (order.pickedItems || []).filter(p => {
        const pBase = extractBaseProductName(p.productName);
        const lBase = extractBaseProductName(cleanProdName);
        const nameMatch = pBase === lBase || (pBase && lBase && (pBase.includes(lBase) || lBase.includes(pBase)));
        const pSize = extractPackingSize(p.packing) || extractPackingSize(p.productName) || extractPackingSize(p.weight);
        const sizeMatch = !itemSize || !pSize || pSize === itemSize;
        return nameMatch && sizeMatch;
      }).length;

      const itemObj = (item && typeof item.toObject === 'function') ? item.toObject() : item;
      const sizeStr = item.weight && !cleanProdName.toUpperCase().includes(item.weight.toUpperCase())
        ? ` (${item.weight})`
        : '';

      return {
        ...itemObj,
        productName: cleanProdName,
        pcsPerPeti,
        totalBoxes,
        pickedBoxes,
        displayProductName: `${cleanProdName}${sizeStr}`,
        packingSize: itemSize,
        displayQty: `${totalBoxes} Boxes (${qty} Pcs)`
      };
    });

    const isPlain = !order || typeof order.toObject !== 'function';
    const baseOrder = isPlain ? order : order.toObject();

    return {
      ...baseOrder,
      items: enrichedItems,
      totalBoxes: orderTotalBoxes,
      totalPieces: orderTotalPieces,
      totalRequiredBoxes: orderTotalBoxes,
      scannedBoxes: (order.pickedItems || []).length
    };
  });
}

// Next sequential QR number. Sorting by createdAt could hand back an already-used
// number after a backdated insert, so pick the highest numeric suffix instead.
const generateNextQrId = async () => {
  const [top] = await StockBox.aggregate([
    { $match: { qrId: /^VNK-\d+$/ } },
    { $project: { num: { $toInt: { $substrBytes: ['$qrId', 4, 12] } } } },
    { $sort: { num: -1 } },
    { $limit: 1 }
  ]);
  return (top?.num || 0) + 1;
};

// -------------------------------------------------------------
// 1. PURCHASE ENTRY & STOCK INWARD MODULE
// -------------------------------------------------------------
const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, purchases });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const createPurchase = async (req, res) => {
  try {
    const {
      invoiceNumber,
      purchaseDate,
      manufacturer,
      invoiceDate,
      transport,
      lrNumber,
      productName,
      category,
      batchNumber,
      packingSize,
      unit,
      quantity,
      weight,
      purchaseCost,
      mrp,
      mfgDate,
      expDate,
      billFileUrl,
      remarks,
      isDraft
    } = req.body;

    if (!invoiceNumber || !manufacturer || !productName || !batchNumber || !quantity) {
      return res.status(400).json({ success: false, message: 'Please fill all required purchase entry fields.' });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive integer.' });
    }

    const status = isDraft ? 'draft' : 'submitted';

    const purchase = await Purchase.create({
      invoiceNumber,
      purchaseDate: purchaseDate || Date.now(),
      manufacturer,
      invoiceDate: invoiceDate || Date.now(),
      transport: transport || '',
      lrNumber: lrNumber || '',
      productName,
      category: category || 'Crop Protection',
      batchNumber,
      packingSize: packingSize || null,
      unit: unit || 'kg',
      quantity: qty,
      weight: weight || packingSize || null,
      purchaseCost: Number(purchaseCost) || 0,
      totalCost: Number(req.body.totalPrice) || (Number(purchaseCost) * qty) || 0,
      costUnit: req.body.costUnit || 'box',
      costRate: Number(req.body.costRate) || Number(purchaseCost) || 0,
      mrp: Number(mrp) || 0,
      mfgDate: mfgDate || Date.now(),
      expDate: expDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      billFileUrl: billFileUrl || '',
      remarks: remarks || '',
      status,
      isLocked: !isDraft,
      createdBy: (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) ? req.user.id : undefined,
      enteredByUsername: req.user?.username || 'warehouse1'
    });

    await AuditLog.create({
      action: isDraft ? 'PURCHASE_DRAFT_CREATED' : 'PURCHASE_SUBMITTED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'PurchaseEntry',
      details: `Logged Purchase #${invoiceNumber} (${qty} boxes of ${productName}, batch ${batchNumber})`
    });

    return res.status(201).json({
      success: true,
      message: isDraft ? 'Purchase entry saved as draft.' : 'Purchase entry submitted! Ready for QR code generation.',
      purchase
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase || purchase.isDeleted) {
      return res.status(404).json({ success: false, message: 'Purchase record not found.' });
    }
    const boxes = await StockBox.find({ purchaseId: purchase._id, isDeleted: { $ne: true } }).select('-history').lean();
    return res.json({ success: true, purchase, boxes });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const finalizePurchaseSubmit = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase record not found.' });

    purchase.status = 'submitted';
    purchase.isLocked = true;
    await purchase.save();

    await AuditLog.create({
      action: 'PURCHASE_SUBMITTED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'PurchaseEntry',
      details: `Finalized and locked purchase #${purchase.invoiceNumber}`
    });

    return res.json({ success: true, message: 'Purchase entry finalized and locked successfully.', purchase });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 2. BARCODE & QR CODE GENERATION & STICKER PRINTING MODULE
// -------------------------------------------------------------
const generatePurchaseQrCodes = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase record not found.' });

    const existingBoxes = await StockBox.countDocuments({ purchaseId: purchase._id });
    if (existingBoxes > 0) {
      const boxes = await StockBox.find({ purchaseId: purchase._id });
      return res.json({
        success: true,
        message: 'QR codes already generated for this purchase entry.',
        boxes
      });
    }

    const currentSeq = await generateNextQrId();
    const now = new Date();
    const actor = req.user?.username || 'Warehouse Worker';

    const docs = Array.from({ length: purchase.quantity }, (_, i) => {
      const qrId = `VNK-${currentSeq + i}`;
      return {
        qrId,
        barcode: qrId,
        purchaseId: purchase._id,
        productName: purchase.productName,
        technicalName: purchase.technicalName || '',
        manufacturer: purchase.manufacturer,
        batchNumber: purchase.batchNumber,
        hsnCode: purchase.hsnCode || '',
        category: purchase.category,
        unit: purchase.unit,
        packing: purchase.packing || purchase.packingSize,
        packingSize: purchase.packingSize,
        weight: purchase.weight || purchase.packingSize,
        purchaseInvoice: purchase.invoiceNumber,
        purchaseCost: purchase.purchaseCost,
        mrp: purchase.mrp,
        mfgDate: purchase.mfgDate,
        expDate: purchase.expDate,
        warehouseLocation: 'Rack A1',
        stickerStatus: 'not_printed',
        verificationStatus: 'pending_verification',
        status: 'pending_verification',
        history: [
          {
            stage: 'Purchase Received',
            title: 'Purchase Bill Logged',
            description: `Received via Purchase Invoice #${purchase.invoiceNumber} from ${purchase.manufacturer}`,
            performedBy: actor,
            timestamp: now
          },
          {
            stage: 'QR Generated',
            title: 'Unique Barcode/QR Assigned',
            description: `Unique identity ${qrId} generated for box`,
            performedBy: actor,
            timestamp: now
          }
        ]
      };
    });

    // Single round trip instead of one save() per box.
    const createdBoxes = await StockBox.insertMany(docs, { ordered: true });

    purchase.status = 'barcode_generated';
    await purchase.save();

    await AuditLog.create({
      action: 'QR_CODES_GENERATED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'QRGenerator',
      details: `Generated ${createdBoxes.length} barcode/QR stickers for Purchase #${purchase.invoiceNumber}`
    });

    return res.status(201).json({
      success: true,
      message: `Successfully generated ${createdBoxes.length} unique barcode/QR IDs!`,
      totalBoxes: createdBoxes.length,
      boxes: createdBoxes
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const recordStickerPrint = async (req, res) => {
  try {
    const { id } = req.params; // box ID or qrId
    const box = await StockBox.findOne({ $or: [{ _id: id }, { qrId: id }] });
    if (!box) return res.status(404).json({ success: false, message: 'Stock box not found.' });

    const isReprint = box.printCount > 0;
    box.printCount += 1;
    box.stickerStatus = isReprint ? 'reprinted' : 'printed';

    box.history.push({
      stage: isReprint ? 'Sticker Reprinted' : 'Sticker Printed',
      title: isReprint ? `Sticker Reprinted (Count: ${box.printCount})` : 'Sticker Printed',
      description: 'Printed barcode sticker label for physical box application',
      performedBy: req.user?.username || 'Warehouse Worker',
      timestamp: new Date()
    });

    await box.save();

    await AuditLog.create({
      action: isReprint ? 'STICKER_REPRINTED' : 'STICKER_PRINTED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'StickerPrinter',
      details: `Printed sticker label for QR ${box.qrId}`
    });

    return res.json({ success: true, message: `Sticker print recorded for ${box.qrId}`, box });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 3. INITIAL STOCK VERIFICATION & SEARCH MODULE
// -------------------------------------------------------------
const getStockBoxes = async (req, res) => {
  try {
    const { search, product, batch, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));

    const esc = (t) => String(t).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const filter = { isDeleted: { $ne: true } };

    if (product) filter.productName = { $regex: esc(product), $options: 'i' };
    if (batch) filter.batchNumber = { $regex: esc(batch), $options: 'i' };
    if (status) filter.status = status;
    if (search && search.trim()) {
      const q = esc(search.trim());
      filter.$or = [
        { qrId: { $regex: q, $options: 'i' } },
        { barcode: { $regex: q, $options: 'i' } },
        { productName: { $regex: q, $options: 'i' } },
        { batchNumber: { $regex: q, $options: 'i' } },
        { purchaseInvoice: { $regex: q, $options: 'i' } }
      ];
    }

    const [boxes, matched, byStatus, pendingVerification] = await Promise.all([
      StockBox.find(filter).select('-history').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      StockBox.countDocuments(filter),
      StockBox.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      StockBox.countDocuments({ isDeleted: { $ne: true }, verificationStatus: 'pending_verification' })
    ]);

    const counts = Object.fromEntries(byStatus.map(r => [r._id, r.count]));
    const summary = {
      total: byStatus.reduce((acc, r) => acc + r.count, 0),
      pendingVerification,
      available: counts.available || 0,
      dispatched: counts.dispatched || 0
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

const verifyInitialStockScan = async (req, res) => {
  try {
    const { barcode } = req.body;
    if (!barcode) {
      return res.status(400).json({ success: false, verified: false, message: 'Barcode / QR ID is required.' });
    }

    const cleanCode = barcode.trim().toUpperCase();
    const box = await StockBox.findOne({
      $or: [{ qrId: cleanCode }, { barcode: cleanCode }],
      isDeleted: false
    });

    if (!box) {
      return res.json({
        success: false,
        verified: false,
        code: 'BARCODE_NOT_FOUND',
        title: 'Barcode Not Found',
        message: `No stock box record found for barcode '${cleanCode}'.`
      });
    }

    if (box.verificationStatus === 'verified' && box.status === 'available') {
      return res.json({
        success: true,
        verified: true,
        alreadyVerified: true,
        title: 'Already Verified',
        message: `Box ${box.qrId} is already verified and available in warehouse stock.`,
        box
      });
    }

    box.verificationStatus = 'verified';
    box.status = 'available';
    box.history.push({
      stage: 'Stock Verified',
      title: 'Initial Physical Stock Verified',
      description: 'Scanned & matched physical product entry with warehouse system',
      performedBy: req.user?.username || 'Warehouse Worker',
      timestamp: new Date()
    });

    await box.save();

    await AuditLog.create({
      action: 'INITIAL_STOCK_VERIFIED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'StockVerification',
      details: `Verified stock box QR ${box.qrId}`
    });

    return res.json({
      success: true,
      verified: true,
      title: 'Stock Verified Successfully',
      message: `Box ${box.qrId} (${box.productName}, Batch: ${box.batchNumber}) verified and marked available for dispatch.`,
      box
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 4. ASSIGNED DEALER ORDERS / BILLS MODULE
// -------------------------------------------------------------
let lastSyncTimestamp = 0;

const getAssignedOrders = async (req, res) => {
  try {
    const { status, search, includeDispatched } = req.query;

    // Auto-sync in background if last sync was > 60 seconds ago
    const now = Date.now();
    if (now - lastSyncTimestamp > 60000) {
      lastSyncTimestamp = now;
      syncB2BInvoices().catch(err => console.warn('[AutoSync] Background sync failed:', err.message));
    }

    const conditions = [];

    if (status) {
      if (status === 'rejected') {
        conditions.push({ $or: [{ orderStatus: 'rejected' }, { isRejected: true }] });
      } else if (status === 'cancelled') {
        conditions.push({ $or: [{ orderStatus: 'cancelled' }, { isCancelled: true }] });
      } else if (status === 'rejected_or_cancelled') {
        conditions.push({
          $or: [
            { orderStatus: { $in: ['rejected', 'cancelled'] } },
            { isRejected: true },
            { isCancelled: true }
          ]
        });
      } else if (status === 'completed' || status === 'dispatched' || status === 'history') {
        conditions.push({
          $or: [
            { orderStatus: { $in: ['completed', 'sent_to_dealer', 'dealer_approved'] } },
            { status: { $in: ['dispatched', 'completed'] } }
          ]
        });
      } else if (status === 'dealer_tracking' || status === 'sent_to_dealer') {
        conditions.push({
          $or: [
            { orderStatus: { $in: ['sent_to_dealer', 'dealer_approved', 'completed'] } },
            { status: 'dispatched' }
          ]
        });
      } else if (status === 'all' || status === 'any') {
        // No status filter
      } else if (status === 'new') {
        conditions.push({
          orderStatus: { $in: ['new', 'viewed'] },
          status: { $nin: ['dispatched', 'completed'] },
          isRejected: { $ne: true },
          isCancelled: { $ne: true }
        });
      } else {
        conditions.push({
          orderStatus: status,
          status: { $nin: ['dispatched', 'completed'] },
          isRejected: { $ne: true },
          isCancelled: { $ne: true }
        });
      }
    } else if (!search && includeDispatched !== 'true') {
      // Default view for Dashboard & Active Queue:
      // Exclude dispatched, completed, cancelled, and rejected orders
      conditions.push({
        status: { $nin: ['dispatched', 'completed'] },
        orderStatus: { $nin: ['completed', 'sent_to_dealer', 'dealer_approved', 'rejected', 'cancelled'] },
        isRejected: { $ne: true },
        isCancelled: { $ne: true }
      });
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      conditions.push({
        $or: [
          { invoiceNo: regex },
          { dealerName: regex },
          { garageName: regex },
          { buyerOrderNo: regex },
          { centralInvoiceId: regex }
        ]
      });
    }

    const filter = conditions.length === 0
      ? {}
      : conditions.length === 1
        ? conditions[0]
        : { $and: conditions };

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [totalCount, orders] = await Promise.all([
      SalesInvoice.countDocuments(filter),
      SalesInvoice.find(filter)
        .sort({ invoiceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('dealerId')
        .lean()
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const enrichedOrders = await enrichOrdersWithPetis(orders);
    return res.json({
      success: true,
      orders: enrichedOrders,
      pagination: {
        total: totalCount,
        totalPages,
        page,
        limit,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages
      },
      lastSync: new Date(lastSyncTimestamp)
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await SalesInvoice.findById(req.params.id).populate('dealerId');
    if (!order) return res.status(404).json({ success: false, message: 'Order / bill not found.' });

    if (order.orderStatus === 'new' && !order.isRejected && !order.isCancelled) {
      order.orderStatus = 'viewed';
      await order.save();
    }

    const [enriched] = await enrichOrdersWithPetis([order]);
    return res.json({ success: true, order: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 5. INTERACTIVE STOCK PICKING MODULE (SCAN STICKER VS BILL)
// -------------------------------------------------------------
const startStockPicking = async (req, res) => {
  try {
    const order = await SalesInvoice.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (order.orderStatus === 'rejected' || order.orderStatus === 'cancelled' || order.isRejected || order.isCancelled) {
      return res.status(400).json({
        success: false,
        code: 'ORDER_CANCELLED_OR_REJECTED',
        message: `Cannot start picking. Order #${order.invoiceNo} has been ${order.orderStatus.toUpperCase()}! Reason: ${order.cancellationReason || order.rejectionReason || 'Order cancelled'}`
      });
    }

    order.orderStatus = 'picking_started';
    await order.save();

    await AuditLog.create({
      action: 'STOCK_PICKING_STARTED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'StockPicking',
      details: `Started picking stock for Order #${order.invoiceNo}`
    });

    return res.json({ success: true, message: `Stock picking started for Order #${order.invoiceNo}`, order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const scanPickingItem = async (req, res) => {
  try {
    const { id } = req.params; // Order ID
    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({ success: false, valid: false, message: 'Barcode / QR ID is required.' });
    }

    const order = await SalesInvoice.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (order.orderStatus === 'rejected' || order.orderStatus === 'cancelled' || order.isRejected || order.isCancelled) {
      return res.status(400).json({
        success: false,
        valid: false,
        code: 'ORDER_CANCELLED_OR_REJECTED',
        message: `Cannot pick items. Order #${order.invoiceNo} has been ${order.orderStatus.toUpperCase()}! Reason: ${order.cancellationReason || order.rejectionReason || 'Order cancelled'}`
      });
    }

    const cleanCode = barcode.trim().toUpperCase();

    // Find stock box by QR ID, Barcode, Product Name, or Product Code
    let box = await StockBox.findOne({
      $or: [{ qrId: cleanCode }, { barcode: cleanCode }],
      isDeleted: { $ne: true }
    });

    // If not found by QR/Barcode, check if input matches product name or product code for available stock
    if (!box) {
      const escapeRegex = (str) => String(str).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      box = await StockBox.findOne({
        productName: { $regex: `^${escapeRegex(barcode.trim())}$`, $options: 'i' },
        status: 'available',
        isDeleted: { $ne: true }
      });
    }

    if (!box) {
      order.failedScanLogs.push({ barcode: cleanCode, errorReason: 'Product / QR ID not found in inventory.' });
      await order.save();
      return res.json({
        success: false,
        valid: false,
        code: 'BARCODE_NOT_FOUND',
        title: 'Product / QR ID Not Found',
        message: `Product or QR ID '${barcode}' does not exist in inventory or has no available stock.`
      });
    }

    // Check if already dispatched or picked in another order
    if (box.status === 'dispatched') {
      order.failedScanLogs.push({ barcode: cleanCode, errorReason: 'Product already dispatched previously.' });
      await order.save();
      return res.json({
        success: false,
        valid: false,
        code: 'ALREADY_DISPATCHED',
        title: 'Already Dispatched',
        message: `Box ${box.qrId} (${box.productName}) has already been dispatched.`
      });
    }

    // Check if already picked in this order
    const alreadyPicked = order.pickedItems.some(p => p.qrId === box.qrId);
    if (alreadyPicked) {
      return res.json({
        success: true,
        valid: true,
        alreadyPicked: true,
        title: 'Already Picked',
        message: `Box ${box.qrId} (${box.productName}) is already in the picked list for this order.`,
        box
      });
    }

    // Validate Product, Packing Size, and Batch matching against order bill items
    const boxBase = extractBaseProductName(box.productName);
    const boxSize = extractPackingSize(box.packing) || extractPackingSize(box.productName) || extractPackingSize(box.weight);

    // 1. Find candidate lines by base product name
    const candidateLines = order.items.filter(line => {
      const lineBase = extractBaseProductName(line.productName);
      const lineName = normText(line.productName);
      const boxName = normText(box.productName);

      const pBaseMatch = boxBase && lineBase && (boxBase === lineBase || boxBase.includes(lineBase) || lineBase.includes(boxBase));
      const pNameMatch = lineName === boxName || (lineName && boxName && (lineName.includes(boxName) || boxName.includes(lineName)));
      const pCodeMatch = line.productCode && box.productCode && normText(line.productCode) === normText(box.productCode);
      return pBaseMatch || pNameMatch || pCodeMatch;
    });

    if (candidateLines.length === 0) {
      order.failedScanLogs.push({
        barcode: cleanCode,
        errorReason: `Product (${box.productName}) not present in order bill.`
      });
      await order.save();
      return res.json({
        success: false,
        valid: false,
        code: 'PRODUCT_MISMATCH',
        title: 'Product Not in Bill Order',
        message: `Product "${box.productName}" (QR: ${box.qrId}) is NOT listed in Order #${order.invoiceNo}!`,
        box
      });
    }

    // 2. Filter candidate lines by packing size
    let sizeMatchedLines = candidateLines;
    if (boxSize) {
      const sizeFiltered = candidateLines.filter(line => {
        const lineSize = extractPackingSize(line.productName) || extractPackingSize(line.weight);
        if (!lineSize) return true;
        return lineSize === boxSize;
      });

      if (sizeFiltered.length === 0) {
        const expectedSizes = candidateLines
          .map(l => l.weight || extractPackingSize(l.productName) || 'N/A')
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .join(', ');
        order.failedScanLogs.push({
          barcode: cleanCode,
          errorReason: `Packing size mismatch. Box is ${box.packing || boxSize}, required: ${expectedSizes}`
        });
        await order.save();
        return res.json({
          success: false,
          valid: false,
          code: 'PACKING_SIZE_MISMATCH',
          title: 'Wrong Packing Size',
          message: `Scanned box is ${box.packing || box.weight || boxSize} ("${box.productName}"), but Order #${order.invoiceNo} requires ${expectedSizes}!`,
          box
        });
      }
      sizeMatchedLines = sizeFiltered;
    }

    // 3. Batch matching (if specified)
    let matchingLine = sizeMatchedLines.find(line => {
      if (!line.batchNumber || !line.batchNumber.trim() || line.batchNumber.trim().toUpperCase() === 'ANY') {
        return true;
      }
      return normText(line.batchNumber) === normText(box.batchNumber);
    });

    if (!matchingLine) {
      matchingLine = sizeMatchedLines[0];
    }

    // Determine pcsPerPeti for this item (Peti chunk size)
    let pcsPerPeti = 10;
    if (box.conversion && Number(box.conversion) > 0) {
      pcsPerPeti = Number(box.conversion);
    } else {
      const prod = await Product.findOne({
        $or: [
          { name: new RegExp(`^${escapeRegexStr(matchingLine.productName)}$`, 'i') },
          { productCode: matchingLine.productCode || box.productCode }
        ],
        isDeleted: { $ne: true }
      }).select('conversion packingSize').lean();
      if (prod && Number(prod.conversion) > 0) {
        pcsPerPeti = Number(prod.conversion);
      } else {
        pcsPerPeti = getPiecesPerPeti(matchingLine.weight || box.packing || box.weight || (prod && prod.packingSize));
      }
    }

    const requiredBoxesForLine = Math.max(1, Math.ceil((matchingLine.quantity || 0) / pcsPerPeti));

    // Count currently picked Peti boxes for this specific line (matching base product AND size)
    const matchingLineSize = extractPackingSize(matchingLine.productName) || extractPackingSize(matchingLine.weight);
    const currentLinePickedCount = order.pickedItems.filter(p => {
      const pBase = extractBaseProductName(p.productName);
      const lBase = extractBaseProductName(matchingLine.productName);
      const nameMatch = pBase === lBase || pBase.includes(lBase) || lBase.includes(pBase);
      const pSize = extractPackingSize(p.packing) || extractPackingSize(p.productName) || extractPackingSize(p.weight);
      const sizeMatch = !matchingLineSize || !pSize || pSize === matchingLineSize;
      return nameMatch && sizeMatch;
    }).length;

    if (currentLinePickedCount >= requiredBoxesForLine) {
      return res.json({
        success: false,
        valid: false,
        code: 'QUANTITY_EXCEEDED',
        title: 'Boxes (Peti) Completed',
        message: `Required ${requiredBoxesForLine} Peti / Boxes (${matchingLine.quantity} Pcs) for ${matchingLine.productName} is already fully picked!`
      });
    }

    // Add Peti box to picked list
    order.pickedItems.push({
      qrId: box.qrId,
      barcode: box.barcode || box.qrId,
      productName: box.productName,
      batchNumber: box.batchNumber,
      weight: box.weight,
      scannedAt: new Date(),
      scannedBy: req.user?.username || 'Warehouse Worker'
    });

    order.scannedCount = order.pickedItems.length;

    // Calculate total required Peti boxes for the whole order
    const products = await Product.find({ isDeleted: { $ne: true } }).select('name productCode conversion packingSize').lean();
    let totalRequiredBoxes = 0;
    for (const itm of order.items) {
      const itmLineName = normText(itm.productName);
      const itmLineCode = normText(itm.productCode);
      const mProd = products.find(p => {
        const pCode = normText(p.productCode);
        const pName = normText(p.name);
        return (itmLineCode && pCode && itmLineCode === pCode) ||
               (itmLineName && pName && (itmLineName === pName || itmLineName.includes(pName) || pName.includes(itmLineName)));
      });
      let itmPcs = (mProd && Number(mProd.conversion) > 0) ? Number(mProd.conversion) : getPiecesPerPeti(itm.weight || (mProd && mProd.packingSize));
      totalRequiredBoxes += Math.max(1, Math.ceil((itm.quantity || 0) / itmPcs));
    }

    if (order.pickedItems.length >= totalRequiredBoxes) {
      order.orderStatus = 'picking_completed';
    }

    await order.save();

    return res.json({
      success: true,
      valid: true,
      title: 'Peti / Box Picked Successfully',
      message: `Peti ${box.qrId} added to picked list. (${order.pickedItems.length}/${totalRequiredBoxes} boxes picked)`,
      box,
      totalPicked: order.pickedItems.length,
      totalRequired: totalRequiredBoxes,
      linePicked: currentLinePickedCount + 1,
      lineRequired: requiredBoxesForLine
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const completeStockPicking = async (req, res) => {
  try {
    const order = await SalesInvoice.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    order.orderStatus = 'picking_completed';
    await order.save();

    await AuditLog.create({
      action: 'STOCK_PICKING_COMPLETED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'StockPicking',
      details: `Completed stock picking for Order #${order.invoiceNo} (${order.pickedItems.length} items picked)`
    });

    return res.json({ success: true, message: 'Stock picking completed successfully!', order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 6. DISPATCH VERIFICATION & DELIVERY INVOICE PDF MODULE
// -------------------------------------------------------------
const getVerificationSummary = async (req, res) => {
  try {
    const order = await SalesInvoice.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const [enriched] = await enrichOrdersWithPetis([order]);
    const totalRequired = enriched.totalBoxes;
    const totalPicked = order.pickedItems.length;
    const isComplete = totalPicked >= totalRequired;

    return res.json({
      success: true,
      order: enriched,
      summary: {
        totalRequired,
        totalPicked,
        isComplete,
        itemsRequired: enriched.items,
        itemsPicked: order.pickedItems,
        failedScanLogs: order.failedScanLogs
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const generateDeliveryInvoice = async (req, res) => {
  try {
    const order = await SalesInvoice.findById(req.params.id).populate('dealerId');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const deliveryInvoiceNo = `DEL-INV-${Date.now().toString().slice(-6)}`;
    order.deliveryInvoiceNo = deliveryInvoiceNo;
    order.orderStatus = 'invoice_generated';
    await order.save();

    await AuditLog.create({
      action: 'DELIVERY_INVOICE_GENERATED',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'DeliveryInvoice',
      details: `Generated Delivery Invoice #${deliveryInvoiceNo} for Order #${order.invoiceNo}`
    });

    return res.json({
      success: true,
      message: `Delivery Invoice #${deliveryInvoiceNo} generated successfully!`,
      deliveryInvoiceNo,
      order
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const markOrderSentToDealer = async (req, res) => {
  try {
    const { id } = req.params;
    const { transportName, vehicleNumber, driverName, driverPhone, lrNumber, remarks } = req.body;

    const order = await SalesInvoice.findById(id).populate('dealerId');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!order.dealerId) {
      return res.status(400).json({ success: false, message: 'This order has no dealer linked. Fix the dealer record before dispatching.' });
    }
    if (!order.pickedItems.length) {
      return res.status(400).json({ success: false, message: 'No boxes have been picked for this order yet.' });
    }

    order.transportName = transportName || 'Direct Transport';
    order.vehicleNumber = vehicleNumber || 'N/A';
    order.driverName = driverName || 'N/A';
    order.driverPhone = driverPhone || 'N/A';
    order.lrNumber = lrNumber || 'N/A';
    order.dispatchedAt = new Date();
    order.orderStatus = 'completed';
    order.status = 'dispatched';
    await order.save();

    // Mark picked boxes as dispatched & create Dispatch record
    const scannedQrIds = order.pickedItems.map(p => p.qrId);
    const dispatchNo = `DSP-${Date.now().toString().slice(-6)}`;

    await Dispatch.create({
      dispatchNo,
      salesInvoiceNo: order.invoiceNo,
      dealerId: order.dealerId._id,
      scannedBoxQrIds: scannedQrIds,
      courierName: transportName || 'Direct Transport',
      vehicleNumber: vehicleNumber || 'N/A',
      driverName: driverName || 'N/A',
      driverMobile: driverPhone || 'N/A',
      deliveryDate: new Date(),
      remarks: remarks || '',
      verifiedBy: req.user?.username || 'Warehouse Worker',
      status: 'dispatched'
    });

    if (scannedQrIds.length) {
      const historyEntry = {
        stage: 'Dispatched',
        title: `Dispatched to Dealer ${order.dealerName}`,
        description: `Transport: ${order.transportName}, Vehicle: ${order.vehicleNumber}`,
        performedBy: req.user?.username || 'Warehouse Worker',
        timestamp: new Date()
      };

      await StockBox.updateMany(
        { qrId: { $in: scannedQrIds } },
        {
          $set: {
            status: 'dispatched',
            assignedInvoiceNo: order.invoiceNo,
            assignedDealerId: order.dealerId._id,
            updatedAt: new Date()
          },
          $push: { history: historyEntry }
        }
      );
    }

    await AuditLog.create({
      action: 'PRODUCTS_SENT_TO_DEALER',
      user: req.user?.username || 'warehouse1',
      role: 'user',
      module: 'Dispatch',
      details: `Dispatched products for Order #${order.invoiceNo} via ${transportName}`
    });

    return res.json({
      success: true,
      message: `Order #${order.invoiceNo} marked as Sent to Dealer. Waiting for dealer approval.`,
      order
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 7. DEALER APPROVAL & BILTY TRACKING MODULE
// -------------------------------------------------------------
const getDealerApprovalStatus = async (req, res) => {
  try {
    const order = await SalesInvoice.findById(req.params.id).populate('dealerId');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    return res.json({
      success: true,
      order: {
        id: order._id,
        invoiceNo: order.invoiceNo,
        dealerName: order.dealerName,
        orderStatus: order.orderStatus,
        dealerApproved: order.dealerApproved,
        dealerApprovedAt: order.dealerApprovedAt,
        biltyUploaded: order.biltyUploaded,
        biltyUrl: order.biltyUrl,
        biltyUploadedAt: order.biltyUploadedAt,
        dispatchPhotoUrl: order.dispatchPhotoUrl,
        dispatchPhotoUploadedAt: order.dispatchPhotoUploadedAt,
        dealerRemarks: order.dealerRemarks
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// -------------------------------------------------------------
// 8. USER DASHBOARD & ACTIVITY SUMMARY MODULE
// -------------------------------------------------------------
const getUserDashboardSummary = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      todayPurchases,
      pendingBarcodeCount,
      pendingVerificationCount,
      newAssignedOrders,
      pickingInProgressCount,
      pendingDealerApprovalCount,
      completedTodayCount,
      totalStock,
      availableStock,
      todayDispatches,
      pendingDispatches
    ] = await Promise.all([
      Purchase.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: startOfDay } }),
      Purchase.countDocuments({ isDeleted: { $ne: true }, status: 'barcode_pending' }),
      StockBox.countDocuments({ isDeleted: { $ne: true }, verificationStatus: 'pending_verification' }),
      SalesInvoice.countDocuments({
        orderStatus: { $in: ['new', 'viewed'] },
        status: { $nin: ['dispatched', 'completed'] },
        isRejected: { $ne: true },
        isCancelled: { $ne: true }
      }),
      SalesInvoice.countDocuments({
        orderStatus: 'picking_started',
        status: { $nin: ['dispatched', 'completed'] },
        isRejected: { $ne: true },
        isCancelled: { $ne: true }
      }),
      SalesInvoice.countDocuments({ orderStatus: { $in: ['sent_to_dealer', 'dealer_approved'] } }),
      SalesInvoice.countDocuments({
        $or: [{ orderStatus: 'completed' }, { status: 'dispatched' }],
        updatedAt: { $gte: startOfDay }
      }),
      StockBox.countDocuments({ isDeleted: { $ne: true } }),
      StockBox.countDocuments({ isDeleted: { $ne: true }, status: 'available' }),
      StockBox.countDocuments({ isDeleted: { $ne: true }, status: 'dispatched', updatedAt: { $gte: startOfDay } }),
      StockBox.countDocuments({ isDeleted: { $ne: true }, status: 'reserved' })
    ]);

    return res.json({
      success: true,
      metrics: {
        todayPurchases,
        pendingBarcodeCount,
        pendingVerificationCount,
        newAssignedOrders,
        pickingInProgressCount,
        pendingDealerApprovalCount,
        completedTodayCount,
        totalStock,
        availableStock,
        todayDispatches,
        pendingDispatches
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const cancelAssignedOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const actor = req.user?.username || 'warehouse1';

    const order = await cancelOrderLocally(id, reason, actor);
    return res.json({
      success: true,
      message: `Order #${order.invoiceNo} cancelled successfully.`,
      order
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const triggerWarehouseB2BSync = async (req, res) => {
  try {
    const result = await syncB2BInvoices();
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
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
};
