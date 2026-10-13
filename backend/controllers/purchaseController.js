const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const StockBox = require('../models/StockBox');
const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
const tallyService = require('../services/tallyService');

// Generate next sequential QR ID (numeric max aggregation to prevent duplicate key collisions)
const generateNextQrId = async () => {
  const [top] = await StockBox.aggregate([
    { $match: { qrId: /^VNK-\d+$/ } },
    { $project: { num: { $toInt: { $substrBytes: ['$qrId', 4, 20] } } } },
    { $sort: { num: -1 } },
    { $limit: 1 }
  ]);
  let nextNum = (top?.num || 0) + 1;
  while (await StockBox.exists({ qrId: `VNK-${nextNum}` })) {
    nextNum++;
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
            packingSize: (item.weight && item.weight.trim()) || (item.packing && item.packing.trim()) || null,
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

    // Resolve official conversion for each item from Product master if not passed or 0
    for (const item of productItems) {
      if (!item.conversion || Number(item.conversion) <= 0) {
        const cleanName = (item.productName || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prod = await Product.findOne({
          name: { $regex: `^${cleanName}$`, $options: 'i' },
          isDeleted: { $ne: true }
        });
        if (prod && prod.conversion > 0) {
          item.conversion = prod.conversion;
        }
      }
      if (item.conversion && Number(item.conversion) > 0 && (!item.cases || Number(item.cases) <= 0)) {
        item.cases = Math.ceil(parseInt(item.quantity, 10) / Number(item.conversion));
      }
    }

    const firstItem = productItems[0];
    const createdBy = (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id))
      ? req.user.id
      : undefined;

    const firstPacking = (firstItem.packing && firstItem.packing.trim()) || (firstItem.weight && firstItem.weight.trim()) || null;
    const firstCasePacking = (firstItem.casePacking && firstItem.casePacking.trim()) || '';
    const firstUnit = (() => {
      if (!firstPacking) return firstItem.unit || 'PCS';
      const s = (firstPacking + ' ' + firstCasePacking).toLowerCase();
      if (s.includes('ml')) return 'ml';
      if (s.includes('ltr') || s.includes('liter') || s.includes('litre')) return 'Ltr';
      if (s.includes('gm') || s.includes('gram')) return 'gm';
      if (s.includes('kg')) return 'kg';
      return firstItem.unit || 'kg';
    })();

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
      packing: firstPacking,
      packingSize: firstPacking,
      unit: firstUnit,
      quantity: totalQty,
      cases: Number(firstItem.cases) || totalQty,
      conversion: Number(firstItem.conversion) || 0,
      casePacking: firstCasePacking,
      weight: firstPacking,
      purchaseCost: Number(firstItem.purchaseCost) || 0,
      totalCost: Number(firstItem.totalPrice) || (Number(firstItem.purchaseCost) * totalQty) || 0,
      costUnit: firstItem.costUnit || 'box',
      costRate: Number(firstItem.costRate) || Number(firstItem.purchaseCost) || 0,
      mfgDate: firstItem.mfgDate || Date.now(),
      expDate: firstItem.expDate || null,
      remarks: firstItem.remarks || '',
      createdBy,
      enteredByUsername: req.user?.username || req.user?.name || 'admin',
      tallySyncStatus: 'pending'
    });

    let currentQrSeq = await generateNextQrId();
    const createdBoxes = [];

    let seqOffset = 0;
    for (const item of productItems) {
      const itemQty = parseInt(item.quantity, 10);
      const itemPacking = (item.packing && item.packing.trim()) || (item.weight && item.weight.trim()) || null;
      const itemCasePacking = (item.casePacking && item.casePacking.trim()) || '';
      const itemUnit = (() => {
        if (!itemPacking) return item.unit || 'PCS';
        const s = (itemPacking + ' ' + itemCasePacking).toLowerCase();
        if (s.includes('ml')) return 'ml';
        if (s.includes('ltr') || s.includes('liter') || s.includes('litre')) return 'Ltr';
        if (s.includes('gm') || s.includes('gram')) return 'gm';
        if (s.includes('kg')) return 'kg';
        return item.unit || 'kg';
      })();

      for (let i = 0; i < itemQty; i++) {
        let candidateSeq = currentQrSeq + seqOffset;
        while (await StockBox.exists({ qrId: `VNK-${candidateSeq}` })) {
          candidateSeq++;
          currentQrSeq++;
        }
        const formattedSeq = String(candidateSeq);
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
          packing: itemPacking,
          packingSize: itemPacking,
          unit: itemUnit,
          cases: Number(item.cases) || 1,
          conversion: Number(item.conversion) || 0,
          casePacking: itemCasePacking,
          weight: itemPacking,
          purchaseInvoice: invoiceNumber,
          purchaseCost: Number(item.purchaseCost) || 0,
          totalCost: Number(item.totalPrice) || (Number(item.purchaseCost) * itemQty) || 0,
          costUnit: item.costUnit || 'box',
          costRate: Number(item.costRate) || Number(item.purchaseCost) || 0,
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

    // Auto-save to Tally in background (cronjob will retry automatically if Tally is offline)
    tallyService.pushWarehousePurchaseToTally(purchase).then(pushRes => {
      if (pushRes && pushRes.success) {
        console.log(`[Auto Tally Push] Successfully synced Purchase #${invoiceNumber} to Tally Prime.`);
      } else {
        console.warn(`[Auto Tally Push] Purchase #${invoiceNumber} will be retried by Tally Cron:`, pushRes?.error || 'Pending');
      }
    }).catch(err => {
      console.warn(`[Auto Tally Push] Background push error for #${invoiceNumber} (Cron will retry):`, err.message);
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

const PDFDocument = require('pdfkit');

const downloadPurchasePdf = async (req, res) => {
  try {
    let purchase = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      purchase = await Purchase.findById(req.params.id);
    }
    if (!purchase) {
      purchase = await Purchase.findOne({ invoiceNumber: req.params.id });
    }
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase record not found' });
    }

    const boxes = await StockBox.find({ purchaseInvoice: purchase.invoiceNumber, isDeleted: false })
      .select('qrId batchNumber productName packing weight warehouseLocation')
      .lean();

    const doc = new PDFDocument({ margin: 25, size: 'A4' });

    const safeInvoiceNo = purchase.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Purchase_Inward_${safeInvoiceNo}.pdf"`);

    doc.pipe(res);

    const primaryColor = '#0F6E56';
    const darkSlate = '#1E293B';

    // Header Banner
    doc.rect(25, 25, 545, 50).fill(primaryColor);
    doc.fillColor('#FFFFFF').fontSize(16).text('VANIKI CROP SCIENCE PVT. LTD.', 35, 33, { bold: true });
    doc.fontSize(8.5).text('WAREHOUSE GOODS INWARD NOTE & PURCHASE INVOICE VOUCHER', 35, 54);

    // Metadata Right Box
    doc.fillColor('#FFFFFF').fontSize(8.5);
    doc.text(`Invoice No: #${purchase.invoiceNumber}`, 360, 33, { align: 'right', width: 200, bold: true });
    const pDate = purchase.purchaseDate || purchase.invoiceDate || purchase.createdAt;
    doc.text(`Date: ${new Date(pDate).toLocaleDateString('en-IN')}`, 360, 46, { align: 'right', width: 200 });
    doc.text(`Tally Voucher: #${purchase.tallyVoucherNumber || 'Direct'}`, 360, 59, { align: 'right', width: 200 });

    // Supplier & Warehouse Info Grid
    let infoY = 88;
    doc.fillColor(primaryColor).fontSize(9.5).text('SUPPLIER / MANUFACTURER DETAILS', 25, infoY, { bold: true });
    doc.text('WAREHOUSE INWARD & LOGISTICS', 310, infoY, { bold: true });
    doc.strokeColor(primaryColor).lineWidth(1).moveTo(25, infoY + 13).lineTo(570, infoY + 13).stroke();

    infoY += 18;
    doc.fillColor(darkSlate).fontSize(8.5);
    doc.text(`Supplier Name: ${purchase.manufacturer || 'Direct Manufacturer'}`, 25, infoY, { width: 270, bold: true });
    doc.text(`Warehouse Location: ${purchase.warehouseLocation || 'RAIPUR GODOWN'}`, 310, infoY, { width: 250, bold: true });

    infoY += 13;
    doc.text(`Batch Number: ${purchase.batchNumber || 'N/A'}`, 25, infoY, { width: 270 });
    doc.text(`Received By: ${purchase.enteredByUsername || 'Warehouse Admin'}`, 310, infoY, { width: 250 });

    infoY += 13;
    doc.text(`Product: ${purchase.productName || 'General Product'}`, 25, infoY, { width: 270 });
    doc.text(`Packing Unit: ${purchase.packing || purchase.weight || 'N/A'}`, 310, infoY, { width: 250 });

    // Table Header
    let tableY = infoY + 22;
    doc.fillColor(primaryColor).fontSize(9.5).text('PURCHASE INWARD ITEM SPECIFICATIONS', 25, tableY, { bold: true });
    doc.strokeColor(primaryColor).lineWidth(1).moveTo(25, tableY + 13).lineTo(570, tableY + 13).stroke();

    tableY += 17;
    doc.rect(25, tableY - 3, 545, 18).fill('#F1F5F9');
    doc.fillColor(darkSlate).fontSize(8).font('Helvetica-Bold');
    doc.text('S.No', 30, tableY);
    doc.text('Product Name & Specification', 65, tableY, { width: 170 });
    doc.text('Batch No', 240, tableY, { width: 75 });
    doc.text('Total Qty', 320, tableY, { width: 60 });
    doc.text('Boxes/Cases', 385, tableY, { width: 60 });
    doc.text('Rate (Rs)', 450, tableY, { width: 50, align: 'right' });
    doc.text('Amount (Rs)', 505, tableY, { width: 60, align: 'right' });

    tableY += 18;
    doc.font('Helvetica').fontSize(8).fillColor('#334155');
    doc.text('1', 30, tableY);
    doc.text(purchase.productName || 'PRODUCT', 65, tableY, { width: 170 });
    doc.text(purchase.batchNumber || 'N/A', 240, tableY, { width: 75 });
    doc.text(`${purchase.quantity || 1} ${purchase.unit || 'kg'}`, 320, tableY, { width: 60 });
    doc.text(`${boxes.length || purchase.cases || 1} Boxes`, 385, tableY, { width: 60 });
    doc.text(`${(purchase.purchaseCost || purchase.costRate || 0).toLocaleString('en-IN')}`, 450, tableY, { width: 50, align: 'right' });
    const totalVal = purchase.totalCost || ((purchase.purchaseCost || 0) * (purchase.quantity || 1)) || 0;
    doc.text(`${totalVal.toLocaleString('en-IN')}`, 505, tableY, { width: 60, align: 'right' });

    tableY += 16;
    doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(25, tableY).lineTo(570, tableY).stroke();

    // Summary Box
    tableY += 8;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(darkSlate);
    doc.text(`Total Invoice Value: Rs. ${totalVal.toLocaleString('en-IN')}`, 350, tableY, { align: 'right', width: 215 });

    // QR Codes Tracking Section
    let qrY = tableY + 25;
    doc.fillColor(primaryColor).fontSize(9.5).text(`STOCK QR CODE TRACKING (${boxes.length} TOTAL BOXES GENERATED)`, 25, qrY, { bold: true });
    doc.strokeColor(primaryColor).lineWidth(1).moveTo(25, qrY + 13).lineTo(570, qrY + 13).stroke();

    qrY += 18;
    doc.font('Helvetica').fontSize(8).fillColor('#475569');
    if (boxes.length > 0) {
      const firstQr = boxes[0].qrId;
      const lastQr = boxes[boxes.length - 1].qrId;
      doc.text(`QR Identifier Range: ${firstQr} to ${lastQr} | Total Stickers: ${boxes.length}`, 25, qrY);
      qrY += 12;

      // Print first 40 sample QRs
      const previewQrs = boxes.slice(0, 40).map(b => b.qrId);
      doc.fontSize(7).fillColor('#64748B');
      doc.text(`Sample Box QR IDs: ${previewQrs.join(', ')}${boxes.length > 40 ? ' ... and more' : ''}`, 25, qrY, { width: 545 });
      qrY += 24;
    } else {
      doc.text('No QR boxes linked to this invoice.', 25, qrY);
      qrY += 16;
    }

    // Signatures Section at bottom
    const sigY = 740;
    doc.strokeColor('#94A3B8').lineWidth(0.5).moveTo(40, sigY).lineTo(170, sigY).stroke();
    doc.moveTo(225, sigY).lineTo(355, sigY).stroke();
    doc.moveTo(420, sigY).lineTo(550, sigY).stroke();

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#475569');
    doc.text('Goods Received By', 40, sigY + 5, { width: 130, align: 'center' });
    doc.text('Warehouse In-Charge', 225, sigY + 5, { width: 130, align: 'center' });
    doc.text('Authorized Signatory', 420, sigY + 5, { width: 130, align: 'center' });

    doc.end();
  } catch (err) {
    console.error('PDF Generation Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = { createPurchase, getPurchases, getPurchaseById, extractPurchaseOcr, downloadPurchasePdf };

