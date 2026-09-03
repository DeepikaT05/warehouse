const Purchase = require('../models/Purchase');
const StockBox = require('../models/StockBox');
const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');

// Generate next sequential QR ID
const generateNextQrId = async () => {
  const lastBox = await StockBox.findOne({}, { qrId: 1 }).sort({ createdAt: -1 });
  let nextNum = 1;
  if (lastBox && lastBox.qrId) {
    const match = lastBox.qrId.match(/VNK-(\d+)/i);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }
  return nextNum;
};

// Create Purchase Entry & Auto-generate Boxes
const createPurchase = async (req, res) => {
  try {
    const {
      invoiceNumber,
      purchaseDate,
      manufacturer,
      invoiceDate,
      transport,
      lrNumber,
      items,
      productName,
      batchNumber,
      quantity,
      weight,
      purchaseCost,
      mfgDate,
      warehouseLocation,
      remarks
    } = req.body;

    if (!invoiceNumber || !manufacturer) {
      return res.status(400).json({ success: false, message: 'Please fill required invoice number and manufacturer fields.' });
    }

    // Determine product items array
    let productItems = [];
    if (Array.isArray(items) && items.length > 0) {
      productItems = items;
    } else if (productName && batchNumber && quantity) {
      productItems = [{
        productName,
        batchNumber,
        quantity,
        weight,
        purchaseCost,
        mfgDate,
        warehouseLocation,
        remarks
      }];
    } else {
      return res.status(400).json({ success: false, message: 'Please add at least one valid product item to the purchase entry.' });
    }

    // Auto-register product names into Product Master catalog
    for (const item of productItems) {
      if (item.productName && item.productName.trim()) {
        const pName = item.productName.trim();
        const pTech = (item.technicalName || '').trim();
        const existing = await Product.findOne({ name: { $regex: `^${pName}$`, $options: 'i' }, isDeleted: false });
        if (!existing) {
          const code = `PRD-${Math.floor(100000 + Math.random() * 900000)}`;
          await Product.create({
            productCode: code,
            name: pName,
            technicalName: pTech,
            category: 'Crop Protection',
            unit: (item.weight && item.weight.toLowerCase().includes('l')) ? 'Ltr' : 'kg',
            packingSize: item.weight || '1 kg',
            mrp: Number(item.purchaseCost) ? Math.round(Number(item.purchaseCost) * 1.5) : 500,
            minStockThreshold: 20,
            description: `Auto-registered from Purchase Invoice #${invoiceNumber}`
          });
        } else if (pTech && !existing.technicalName) {
          existing.technicalName = pTech;
          await existing.save();
        }
      }
    }

    // Calculate total quantity across all items
    let totalQty = 0;
    for (const item of productItems) {
      const q = parseInt(item.quantity, 10);
      if (isNaN(q) || q <= 0) {
        return res.status(400).json({ success: false, message: `Invalid quantity for product ${item.productName || 'item'}.` });
      }
      totalQty += q;
    }

    const firstItem = productItems[0];
    const purchase = await Purchase.create({
      invoiceNumber,
      purchaseDate: purchaseDate || Date.now(),
      manufacturer,
      invoiceDate: invoiceDate || Date.now(),
      transport: transport || '',
      lrNumber: lrNumber || '',
      productName: firstItem.productName,
      technicalName: firstItem.technicalName || '',
      hsnCode: firstItem.hsnCode || '',
      batchNumber: firstItem.batchNumber,
      packing: firstItem.packing || firstItem.weight || '1 kg',
      packingSize: firstItem.packing || firstItem.weight || '1 kg',
      quantity: totalQty,
      cases: Number(firstItem.cases) || totalQty,
      casePacking: firstItem.casePacking || '',
      weight: firstItem.weight || firstItem.packing || '1 kg',
      purchaseCost: Number(firstItem.purchaseCost) || 0,
      mfgDate: firstItem.mfgDate || Date.now(),
      expDate: firstItem.expDate || null,
      remarks: firstItem.remarks || '',
      createdBy: req.user?.id
    });

    let currentQrSeq = await generateNextQrId();
    const createdBoxes = [];

    let seqOffset = 0;
    for (const item of productItems) {
      const itemQty = parseInt(item.quantity, 10);
      for (let i = 0; i < itemQty; i++) {
        const formattedSeq = String(currentQrSeq + seqOffset);
        const qrId = `VNK-${formattedSeq}`;
        const barcode = `VNK-${formattedSeq}`;

        const box = new StockBox({
          qrId,
          barcode,
          purchaseId: purchase._id,
          productName: item.productName,
          technicalName: item.technicalName || '',
          manufacturer,
          hsnCode: item.hsnCode || '',
          batchNumber: item.batchNumber,
          packing: item.packing || item.weight || '1 kg',
          packingSize: item.packing || item.weight || '1 kg',
          cases: Number(item.cases) || 1,
          casePacking: item.casePacking || '',
          weight: item.weight || item.packing || '1 kg',
          purchaseInvoice: invoiceNumber,
          purchaseCost: Number(item.purchaseCost) || 0,
          mfgDate: item.mfgDate || Date.now(),
          expDate: item.expDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          warehouseLocation: item.warehouseLocation || 'Rack A1',
          status: 'available',
          history: [
            {
              stage: 'Purchase Received',
              title: 'Purchase Bill Logged',
              description: `Received via Purchase Invoice #${invoiceNumber} from ${manufacturer}`,
              performedBy: req.user?.name || 'Warehouse Operator',
              timestamp: new Date()
            },
            {
              stage: 'QR Generated',
              title: 'Unique Identity Assigned',
              description: `QR ID ${qrId} generated for box`,
              performedBy: req.user?.name || 'Warehouse Operator',
              timestamp: new Date()
            },
            {
              stage: 'Stock Available',
              title: 'Stored in Warehouse',
              description: `Stored at ${item.warehouseLocation || 'Rack A1'}`,
              performedBy: req.user?.name || 'Warehouse Operator',
              timestamp: new Date()
            }
          ]
        });

        await box.save();
        createdBoxes.push(box);
        seqOffset++;
      }
    }

    await AuditLog.create({
      action: 'PURCHASE_ENTRY',
      user: req.user?.username || 'user',
      role: req.user?.role || 'warehouse',
      details: `Created Purchase #${invoiceNumber} (${totalQty} boxes across ${productItems.length} products)`
    });

    return res.status(201).json({
      success: true,
      message: `Purchase bill saved successfully. Generated ${totalQty} unique box QR stickers across ${productItems.length} product(s)!`,
      purchase,
      totalBoxesGenerated: createdBoxes.length,
      firstQrId: createdBoxes[0]?.qrId,
      lastQrId: createdBoxes[createdBoxes.length - 1]?.qrId
    });
  } catch (err) {
    console.error('Create Purchase Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 }).populate('createdBy', 'name username');
    return res.json({ success: true, purchases });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase record not found' });
    const boxes = await StockBox.find({ purchaseId: purchase._id });
    return res.json({ success: true, purchase, boxes });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const { extractPurchaseBillWithGemini } = require('../utils/geminiOcrService');

const extractPurchaseOcr = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Please upload an invoice file (PDF, JPG, PNG).' });
    }

    const ocrResult = await extractPurchaseBillWithGemini(file.buffer, file.mimetype, file.originalname);
    return res.json({
      success: true,
      message: `Extracted purchase bill details successfully using ${ocrResult.modelUsed}!`,
      ocrData: ocrResult.ocrData,
      modelUsed: ocrResult.modelUsed
    });
  } catch (err) {
    console.error('Gemini Purchase OCR Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createPurchase, getPurchases, getPurchaseById, extractPurchaseOcr };

