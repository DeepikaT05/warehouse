const Dispatch = require('../models/Dispatch');
const StockBox = require('../models/StockBox');
const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const AuditLog = require('../models/AuditLog');
const Product = require('../models/Product');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

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
  const lineName = (name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const lineCode = (code || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const itemWeight = (weight || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  if (lineCode) {
    const byCode = products.find(p => (p.productCode || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '') === lineCode);
    if (byCode) return byCode;
  }

  if (itemWeight) {
    const byNameAndPack = products.find(p => {
      const pName = (p.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const pPack = (p.packingSize || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const nameMatches = pName === lineName || pName.includes(lineName) || lineName.includes(pName);
      const packMatches = pPack === itemWeight || pPack.includes(itemWeight) || itemWeight.includes(pPack) || pName.includes(itemWeight);
      return nameMatches && packMatches;
    });
    if (byNameAndPack) return byNameAndPack;
  }

  const exactName = products.find(p => (p.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '') === lineName);
  if (exactName) return exactName;

  return products.find(p => {
    const pName = (p.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    return lineName.includes(pName) || pName.includes(lineName);
  });
}

// Module 8: Scan & Verify QR Code (Green / Red Screen logic)
const verifyBoxScan = async (req, res) => {
  try {
    const { qrId, salesInvoiceNo } = req.body;

    if (!qrId) {
      return res.status(400).json({
        success: false,
        verified: false,
        code: 'MISSING_DATA',
        reason: 'QR ID or Barcode is required.'
      });
    }

    const cleanQrId = qrId.trim().toUpperCase();

    // 1. Find Box by QR ID or Barcode
    const box = await StockBox.findOne({
      $or: [{ qrId: cleanQrId }, { barcode: cleanQrId }],
      isDeleted: { $ne: true }
    }).select('-history').lean();

    if (!box) {
      return res.json({
        success: false,
        verified: false,
        code: 'PRODUCT_NOT_EXISTS',
        title: 'Wrong Product',
        reason: `QR ID '${cleanQrId}' does not exist in inventory master database.`
      });
    }

    // 2. Check if box is available
    if (box.status === 'dispatched') {
      return res.json({
        success: false,
        verified: false,
        code: 'ALREADY_DISPATCHED',
        title: 'Already Dispatched',
        reason: `Box ${box.qrId} has already been dispatched previously!`,
        box
      });
    }

    // If no sales invoice is specified -> General Warehouse Stock Verification
    if (!salesInvoiceNo || !salesInvoiceNo.trim()) {
      return res.json({
        success: true,
        verified: true,
        code: 'BOX_VERIFIED',
        title: 'STOCK VERIFIED',
        reason: `Product: ${box.productName} | Batch: ${box.batchNumber || 'N/A'} | Loc: ${box.warehouseLocation || 'Warehouse'}`,
        box: {
          id: box._id,
          qrId: box.qrId,
          productName: box.productName,
          batchNumber: box.batchNumber,
          weight: box.weight,
          warehouseLocation: box.warehouseLocation,
          status: box.status
        }
      });
    }

    // 3. Find Sales Invoice if provided
    const invoice = await SalesInvoice.findOne({ invoiceNo: salesInvoiceNo.trim() }).populate('dealerId');
    if (!invoice) {
      return res.json({
        success: false,
        verified: false,
        code: 'INVOICE_NOT_FOUND',
        title: 'Invoice Mismatch',
        reason: `Sales Invoice #${salesInvoiceNo} not found in system.`
      });
    }

    if (invoice.orderStatus === 'rejected' || invoice.orderStatus === 'cancelled' || invoice.isCancelled || invoice.isRejected) {
      return res.json({
        success: false,
        verified: false,
        code: 'INVOICE_CANCELLED_OR_REJECTED',
        title: 'ORDER CANCELLED / REJECTED',
        reason: `Sales Invoice #${salesInvoiceNo} has been ${invoice.orderStatus.toUpperCase()}! Reason: ${invoice.cancellationReason || invoice.rejectionReason || 'Order cancelled'}. Do NOT dispatch this stock.`
      });
    }

    // 4. Validate Product, Packing Size, & Strict Batch Number Match against invoice items
    const norm = (s) => (s || '').toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    const boxBase = extractBaseProductName(box.productName);
    const boxSize = extractPackingSize(box.packing) || extractPackingSize(box.productName) || extractPackingSize(box.weight);

    // 4a. Match invoice items by Base Product Name
    const matchingProductItems = invoice.items.filter(item => {
      const itemBase = extractBaseProductName(item.productName);
      const lineName = norm(item.productName);
      const boxName = norm(box.productName);

      const pBaseMatch = boxBase && itemBase && (boxBase === itemBase || boxBase.includes(itemBase) || itemBase.includes(boxBase));
      const pNameMatch = lineName === boxName || (lineName && boxName && (lineName.includes(boxName) || boxName.includes(lineName)));
      const pCodeMatch = item.productCode && box.productCode && norm(item.productCode) === norm(box.productCode);
      return pBaseMatch || pNameMatch || pCodeMatch;
    });

    if (matchingProductItems.length === 0) {
      return res.json({
        success: false,
        verified: false,
        code: 'PRODUCT_MISMATCH',
        title: 'Wrong Product (Mismatch)',
        reason: `Scanned box product "${box.productName}" (QR: ${box.qrId}) is NOT in Invoice #${salesInvoiceNo}!`,
        box,
        invoice
      });
    }

    // 4b. Strict Packing Size Matching (If packing size is specified on box or line)
    let matchingSizeItems = matchingProductItems;
    if (boxSize) {
      const sizeFiltered = matchingProductItems.filter(item => {
        const itemSize = extractPackingSize(item.productName) || extractPackingSize(item.weight);
        if (!itemSize) return true; // If invoice item doesn't specify size, allow
        return itemSize === boxSize;
      });

      if (sizeFiltered.length === 0) {
        const requiredSizes = matchingProductItems
          .map(i => i.weight || extractPackingSize(i.productName) || 'N/A')
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .join(', ');
        return res.json({
          success: false,
          verified: false,
          code: 'PACKING_SIZE_MISMATCH',
          title: 'Wrong Packing Size (Mismatch)',
          reason: `Scanned box is ${box.packing || box.weight || boxSize} ("${box.productName}" QR: ${box.qrId}), but Invoice #${salesInvoiceNo} requires ${requiredSizes}!`,
          box,
          invoice
        });
      }
      matchingSizeItems = sizeFiltered;
    }

    // 4c. Strict Batch Number Matching
    const matchingItem = matchingSizeItems.find(item => {
      if (!item.batchNumber || !item.batchNumber.trim() || item.batchNumber.trim().toUpperCase() === 'ANY') {
        return true;
      }
      const itemBatch = norm(item.batchNumber);
      const boxBatch = norm(box.batchNumber);
      return itemBatch === boxBatch;
    });

    if (!matchingItem) {
      const expectedBatches = matchingSizeItems.map(i => i.batchNumber).filter(Boolean).join(', ') || 'N/A';
      return res.json({
        success: false,
        verified: false,
        code: 'BATCH_MISMATCH',
        title: 'Wrong Batch Number (Mismatch)',
        reason: `Box has Batch "${box.batchNumber || 'N/A'}" (QR: ${box.qrId}), but Invoice #${salesInvoiceNo} requires Batch "${expectedBatches}" for "${box.productName}"!`,
        box,
        invoice
      });
    }

    // 5. If Product, Size, & Batch match -> GREEN SCREEN (Verified)
    const products = await Product.find({ isDeleted: { $ne: true } }).select('name productCode conversion packingSize').lean();
    let pcsPerPeti = box.conversion && Number(box.conversion) > 0 ? Number(box.conversion) : 0;
    if (!pcsPerPeti) {
      const prod = matchProduct(matchingItem.productName, matchingItem.productCode, matchingItem.weight || box.packing || box.weight, products);
      pcsPerPeti = (prod && Number(prod.conversion) > 0) ? Number(prod.conversion) : getPiecesPerPeti(matchingItem.weight || box.packing || box.weight);
    }
    const orderedBoxes = Math.max(1, Math.ceil((matchingItem.quantity || 1) / pcsPerPeti));

    // Enrich invoice items with totalBoxes and formatted packing size
    const enrichedInvoiceItems = (invoice.items || []).map(itm => {
      const itmProdName = (itm.productName || '').replace(/\s+/g, ' ').trim();
      const mProd = matchProduct(itmProdName, itm.productCode, itm.weight, products);
      const itmPcs = (mProd && Number(mProd.conversion) > 0) ? Number(mProd.conversion) : getPiecesPerPeti(itm.weight || (mProd && mProd.packingSize));
      const totalBoxes = Math.max(1, Math.ceil((itm.quantity || 1) / itmPcs));
      const itmObj = itm.toObject ? itm.toObject() : itm;
      const sizeStr = itm.weight && !itmProdName.toUpperCase().includes(itm.weight.toUpperCase())
        ? ` (${itm.weight})`
        : '';
      return {
        ...itmObj,
        productName: itmProdName,
        pcsPerPeti: itmPcs,
        totalBoxes,
        displayProductName: `${itmProdName}${sizeStr}`,
        displayQty: `${totalBoxes} Boxes (${itm.quantity} Pcs)`
      };
    });

    const cleanMatchedProdName = matchingItem && matchingItem.productName
      ? (matchingItem.productName || '').replace(/\s+/g, ' ').trim()
      : (box.productName || '').replace(/\s+/g, ' ').trim();

    // Persist verified box in invoice.pickedItems so scan progress is never lost
    if (invoice && invoice._id) {
      const alreadyPicked = (invoice.pickedItems || []).some(p => p.qrId === box.qrId);
      if (!alreadyPicked) {
        await SalesInvoice.updateOne(
          { _id: invoice._id },
          {
            $push: {
              pickedItems: {
                qrId: box.qrId,
                barcode: box.barcode || box.qrId,
                productName: cleanMatchedProdName,
                batchNumber: box.batchNumber || '',
                weight: box.weight || box.packing,
                scannedAt: new Date(),
                scannedBy: req.user?.username || 'Warehouse Operator'
              }
            },
            $inc: { scannedCount: 1 }
          }
        );
      }
    }

    return res.json({
      success: true,
      verified: true,
      code: 'VERIFIED_READY',
      title: 'VERIFIED - BATCH MATCH',
      reason: `Box ${box.qrId} (${cleanMatchedProdName} | Batch: ${box.batchNumber || 'N/A'}) matches Invoice #${salesInvoiceNo} for dealer ${invoice.dealerName || 'Dealer'}.`,
      box: {
        id: box._id,
        qrId: box.qrId,
        productName: cleanMatchedProdName,
        batchNumber: (matchingItem && matchingItem.batchNumber && matchingItem.batchNumber.toUpperCase() !== 'ANY')
          ? (matchingItem.batchNumber || '').trim()
          : (box.batchNumber || '').trim(),
        weight: (matchingItem && matchingItem.weight) || box.weight,
        packing: (matchingItem && matchingItem.weight) || box.packing || box.weight,
        warehouseLocation: box.warehouseLocation,
        pcsPerPeti
      },
      matchedItem: {
        productName: cleanMatchedProdName,
        batchNumber: (matchingItem.batchNumber || '').trim(),
        orderedQuantity: matchingItem.quantity || 1,
        orderedBoxes: orderedBoxes,
        pcsPerPeti: pcsPerPeti,
        weight: matchingItem.weight || box.weight
      },
      invoice: {
        invoiceNo: invoice.invoiceNo,
        dealerName: invoice.dealerName,
        garageName: invoice.garageName,
        items: enrichedInvoiceItems
      }
    });
  } catch (err) {
    console.error('Verify Scan Error:', err);
    return res.status(500).json({ success: false, verified: false, message: err.message });
  }
};

// Module 9: Save Final Delivery & Dispatch Confirmation
const confirmDispatch = async (req, res) => {
  try {
    const {
      salesInvoiceNo,
      scannedQrIds,
      courierName,
      vehicleNumber,
      driverName,
      driverMobile,
      deliveryDate,
      expectedDelivery,
      remarks,
      handoverTo,
      dispatchPhotoUrl
    } = req.body;

    if (!scannedQrIds || !Array.isArray(scannedQrIds) || scannedQrIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide scanned box QR IDs.' });
    }

    const cleanInvoiceNo = (salesInvoiceNo && salesInvoiceNo.trim()) ? salesInvoiceNo.trim() : `DSP-INV-${Date.now().toString().slice(-4)}`;
    const invoice = await SalesInvoice.findOne({
      $or: [
        { invoiceNo: cleanInvoiceNo },
        { invoiceNo: { $regex: `^${cleanInvoiceNo}$`, $options: 'i' } },
        { orderId: cleanInvoiceNo }
      ]
    }).populate('dealerId');

    if (invoice && (invoice.orderStatus === 'rejected' || invoice.orderStatus === 'cancelled' || invoice.isCancelled || invoice.isRejected)) {
      return res.status(400).json({
        success: false,
        message: `Cannot dispatch. Order #${cleanInvoiceNo} is ${invoice.orderStatus.toUpperCase()}! Reason: ${invoice.cancellationReason || invoice.rejectionReason || 'Order cancelled'}`
      });
    }

    let dealerId = invoice?.dealerId?._id;
    if (!dealerId) {
      const defaultDealer = await Dealer.findOne();
      dealerId = defaultDealer ? defaultDealer._id : null;
    }

    const dispatchNo = `DSP-${Date.now().toString().slice(-6)}`;

    const dispatch = await Dispatch.create({
      dispatchNo,
      salesInvoiceNo: cleanInvoiceNo,
      dealerId,
      scannedBoxQrIds: scannedQrIds,
      courierName: courierName || 'Direct Transport',
      vehicleNumber: vehicleNumber || 'N/A',
      driverName: driverName || 'N/A',
      driverMobile: driverMobile || 'N/A',
      deliveryDate: deliveryDate || Date.now(),
      expectedDelivery: expectedDelivery || Date.now(),
      remarks: remarks || '',
      verifiedBy: req.user?.name || 'Warehouse Operator',
      handoverTo: handoverTo || (invoice?.dealerName || 'Consignee / Customer'),
      dispatchPhotoUrl: dispatchPhotoUrl || '',
      dispatchPhotoUploadedAt: dispatchPhotoUrl ? new Date() : null,
      status: 'dispatched'
    });

    // Update all scanned boxes in one bulk write instead of a findOne+save per box.
    const dName = invoice?.dealerName || 'Valued Dealer';
    const gName = invoice?.garageName || 'Branch';
    const actor = req.user?.name || 'Warehouse Operator';
    const now = new Date();

    const history = [
      {
        stage: 'Invoice Assigned',
        title: `Assigned to Invoice #${cleanInvoiceNo}`,
        description: `Dealer: ${dName} (${gName})`,
        performedBy: actor,
        timestamp: now
      },
      {
        stage: 'Verified',
        title: 'QR Scan Verified',
        description: 'Checked before dispatch - All details match',
        performedBy: actor,
        timestamp: now
      },
      {
        stage: 'Dispatched',
        title: `Dispatched via ${courierName || 'Courier'}`,
        description: `Vehicle: ${vehicleNumber || 'N/A'}, Driver: ${driverName || 'N/A'} (${driverMobile || 'N/A'})`,
        performedBy: actor,
        timestamp: now
      }
    ];

    if (dispatchPhotoUrl) {
      history.push({
        stage: 'Goods Photo Captured',
        title: 'Dispatched Goods Photo Stored',
        description: 'Physical proof of loaded products stored during handover',
        performedBy: actor,
        timestamp: now
      });
    }

    history.push({
      stage: 'Delivered',
      title: 'Handed to Delivery Agent',
      description: `Dispatched for delivery to ${dName}`,
      performedBy: actor,
      timestamp: now
    });

    // Only the boxes whose QRs were explicitly scanned must be marked as dispatched
    const allBoxesToDispatch = [...new Set(scannedQrIds.filter(Boolean))];

    const boxUpdate = await StockBox.updateMany(
      { qrId: { $in: allBoxesToDispatch }, isDeleted: { $ne: true } },
      {
        $set: {
          status: 'dispatched',
          assignedInvoiceNo: cleanInvoiceNo,
          assignedDealerId: dealerId || null,
          dispatchId: dispatch._id,
          updatedAt: now
        },
        $push: { history: { $each: history } }
      }
    );

    // Update invoice status if invoice exists
    if (invoice) {
      invoice.status = 'dispatched';
      invoice.orderStatus = 'completed';
      if (!invoice.dispatchedAt) invoice.dispatchedAt = now;
      invoice.scannedCount = scannedQrIds.length;

      // Persist pickedItems from scanned boxes so previously scanned items never disappear
      const scannedBoxes = await StockBox.find({ qrId: { $in: scannedQrIds } }).lean();
      invoice.pickedItems = scannedBoxes.map(b => ({
        qrId: b.qrId,
        barcode: b.barcode || b.qrId,
        productName: b.productName,
        batchNumber: b.batchNumber,
        weight: b.weight || b.packing,
        scannedAt: now,
        scannedBy: actor
      }));

      if (dispatchPhotoUrl) {
        invoice.dispatchPhotoUrl = dispatchPhotoUrl;
        invoice.dispatchPhotoUploadedAt = new Date();
      }
      await invoice.save();
    }

    await AuditLog.create({
      action: 'DISPATCH_COMPLETED',
      user: req.user?.username || 'warehouse',
      role: req.user?.role || 'warehouse',
      details: `Completed Dispatch #${dispatchNo} for Invoice #${salesInvoiceNo} (${scannedQrIds.length} boxes${dispatchPhotoUrl ? ' with photo proof' : ''})`
    });

    return res.status(201).json({
      success: true,
      message: `Dispatch #${dispatchNo} completed. ${boxUpdate.modifiedCount} of ${scannedQrIds.length} boxes updated to Dispatched.`,
      dispatch
    });
  } catch (err) {
    console.error('Confirm Dispatch Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Module 9B: Standalone Dispatched Goods Photo Upload Endpoint
const uploadDispatchPhoto = async (req, res) => {
  try {
    const { salesInvoiceNo, dispatchId, photoUrl } = req.body;
    if (!photoUrl) {
      return res.status(400).json({ success: false, message: 'Photo string or URL is required.' });
    }

    let dispatchRecord = null;
    let invoiceRecord = null;

    if (dispatchId) {
      dispatchRecord = await Dispatch.findById(dispatchId);
    } else if (salesInvoiceNo) {
      dispatchRecord = await Dispatch.findOne({ salesInvoiceNo }).sort({ createdAt: -1 });
    }

    if (dispatchRecord) {
      dispatchRecord.dispatchPhotoUrl = photoUrl;
      dispatchRecord.dispatchPhotoUploadedAt = new Date();
      await dispatchRecord.save();
    }

    const targetInvoiceNo = salesInvoiceNo || (dispatchRecord ? dispatchRecord.salesInvoiceNo : null);
    if (targetInvoiceNo) {
      invoiceRecord = await SalesInvoice.findOne({ invoiceNo: targetInvoiceNo });
      if (invoiceRecord) {
        invoiceRecord.dispatchPhotoUrl = photoUrl;
        invoiceRecord.dispatchPhotoUploadedAt = new Date();
        await invoiceRecord.save();
      }
    }

    return res.json({
      success: true,
      message: 'Dispatched goods photo proof stored successfully!',
      dispatchPhotoUrl: photoUrl,
      invoiceNo: targetInvoiceNo
    });
  } catch (err) {
    console.error('Upload Dispatch Photo Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Module 10: Generate Delivery Statement PDF
const downloadDeliveryStatementPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const dispatch = await Dispatch.findById(id).populate('dealerId');

    if (!dispatch) {
      return res.status(404).json({ success: false, message: 'Dispatch record not found.' });
    }

    // A5 Size Page Layout (419.53 x 595.28 points) for Delivery Box Attachment
    const doc = new PDFDocument({ margin: 20, size: 'A5' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Delivery_Statement_${dispatch.dispatchNo}_A5.pdf"`);

    doc.pipe(res);

    // Color Theme (#0F6E56)
    const primaryColor = '#0F6E56';

    // A5 Header Banner (x: 20, y: 20, width: 379.5, height: 44)
    doc.rect(20, 20, 379.5, 44).fill(primaryColor);
    doc.fillColor('#FFFFFF').fontSize(13).text('VANIKI CROP SCIENCE', 28, 27, { bold: true });
    doc.fontSize(6.5).text('WAREHOUSE DELIVERY STATEMENT & BOX PACKING SLIP', 28, 44);

    // Document Metadata Right Box (A5)
    doc.fillColor('#FFFFFF').fontSize(7);
    doc.text(`Statement No: #${dispatch.dispatchNo}`, 240, 27, { align: 'right', width: 150, bold: true });
    doc.text(`Date: ${new Date(dispatch.dispatchDate || Date.now()).toLocaleDateString()}`, 240, 37, { align: 'right', width: 150 });
    doc.text(`Invoice No: #${dispatch.salesInvoiceNo}`, 240, 47, { align: 'right', width: 150, bold: true });

    // Dealer & Logistics Grid Section (A5)
    let infoY = 70;
    doc.fillColor(primaryColor).fontSize(8.5).text('DEALER & DELIVERY DESTINATION', 20, infoY, { bold: true });
    doc.text('COURIER & LOGISTICS', 215, infoY, { bold: true });
    doc.strokeColor(primaryColor).lineWidth(0.75).moveTo(20, infoY + 11).lineTo(399.5, infoY + 11).stroke();

    infoY += 15;
    doc.fillColor('#333333').fontSize(7);
    doc.text(`Dealer Name: ${dispatch.dealerId?.dealerName || dispatch.dealerId?.firmName || 'N/A'}`, 20, infoY, { width: 190 });
    doc.text(`Courier Service: ${dispatch.courierName || 'Direct Logistics'}`, 215, infoY, { width: 180 });

    infoY += 10;
    doc.text(`Garage/Store: ${dispatch.dealerId?.garageName || 'Main Store'}`, 20, infoY, { width: 190 });
    doc.text(`Vehicle Number: ${dispatch.vehicleNumber || 'N/A'}`, 215, infoY, { width: 180 });

    infoY += 10;
    const fullAddr = [dispatch.dealerId?.address, dispatch.dealerId?.city, dispatch.dealerId?.state, dispatch.dealerId?.pincode].filter(Boolean).join(', ') || 'N/A';
    doc.text(`Address: ${fullAddr}`, 20, infoY, { width: 190 });
    doc.text(`Driver: ${dispatch.driverName || 'N/A'} (${dispatch.driverMobile || 'N/A'})`, 215, infoY, { width: 180 });

    infoY += 10;
    doc.text(`Phone: ${dispatch.dealerId?.phone || 'N/A'} | GSTIN: ${dispatch.dealerId?.gstNumber || 'N/A'}`, 20, infoY, { width: 190 });
    doc.text(`Handover To: ${dispatch.handoverTo || 'Authorized Delivery Staff'}`, 215, infoY, { width: 180 });

    // Scanned QR Box Items Table (A5)
    let tableY = infoY + 18;
    doc.fillColor(primaryColor).fontSize(8.5).text(`VERIFIED DISPATCHED PRODUCTS SUMMARY (${dispatch.scannedBoxQrIds?.length || 0} TOTAL BOXES)`, 20, tableY, { bold: true });
    doc.strokeColor(primaryColor).lineWidth(0.75).moveTo(20, tableY + 11).lineTo(399.5, tableY + 11).stroke();

    tableY += 14;
    doc.fillColor('#1E293B').fontSize(7);
    doc.text('S.No', 22, tableY, { bold: true });
    doc.text('Product & Composition', 44, tableY, { bold: true, width: 130 });
    doc.text('Batch No.', 176, tableY, { bold: true, width: 55 });
    doc.text('Packing', 233, tableY, { bold: true, width: 42 });
    doc.text('Qty (Boxes)', 277, tableY, { bold: true, width: 48, align: 'center' });
    doc.text('QR IDs Range', 327, tableY, { bold: true, width: 72 });

    tableY += 11;
    doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(20, tableY).lineTo(399.5, tableY).stroke();
    tableY += 4;

    const boxes = await StockBox.find({ qrId: { $in: dispatch.scannedBoxQrIds || [] } }).select('-history').lean();

    // Group boxes by Product + Batch
    const groupMap = new Map();
    boxes.forEach(box => {
      const key = `${box.productName || 'General Product'}___${box.batchNumber || 'N/A'}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          productName: box.productName || 'General Product',
          technicalName: box.technicalName || '',
          batchNumber: box.batchNumber || 'N/A',
          packing: box.packing || box.weight || box.packingSize || null,
          qrIds: [box.qrId],
          quantity: 1
        });
      } else {
        const g = groupMap.get(key);
        g.quantity += 1;
        g.qrIds.push(box.qrId);
      }
    });

    const groupedItems = Array.from(groupMap.values());

    groupedItems.forEach((item, idx) => {
      if (tableY > 500) {
        doc.addPage();
        tableY = 30;
      }

      const qrSummary = item.qrIds.length > 2 
        ? `${item.qrIds[0]}..${item.qrIds[item.qrIds.length - 1]} (${item.qrIds.length})` 
        : item.qrIds.join(', ');

      doc.fillColor('#1E293B').fontSize(7);
      doc.text(`${idx + 1}`, 22, tableY);

      // Product + Technical Name
      let pDisplay = item.productName;
      if (item.technicalName) {
        pDisplay += `\n(${item.technicalName})`;
      }
      doc.text(pDisplay, 44, tableY, { width: 128 });
      doc.text(item.batchNumber, 176, tableY, { width: 55 });
      doc.text(item.packing, 233, tableY, { width: 42 });

      // Quantity (Boxes) in bold highlight
      doc.fillColor(primaryColor).text(`${item.quantity} Boxes`, 277, tableY, { bold: true, width: 48, align: 'center' });

      // QR summary
      doc.fillColor('#475569').text(qrSummary, 327, tableY, { width: 72 });

      const rowHeight = item.technicalName ? 20 : 13;
      tableY += rowHeight;
      doc.strokeColor('#F1F5F9').lineWidth(0.5).moveTo(20, tableY).lineTo(399.5, tableY).stroke();
      tableY += 3;
    });

    // Total summary bar (A5)
    tableY += 4;
    doc.rect(20, tableY, 379.5, 16).fill('#F8FAFC');
    doc.fillColor(primaryColor).fontSize(7.5).text(`TOTAL DISPATCHED: ${dispatch.scannedBoxQrIds?.length || 0} VERIFIED BOXES`, 26, tableY + 4, { bold: true });
    tableY += 22;

    // Signatures Section (A5)
    tableY = Math.max(tableY + 15, 520);
    doc.strokeColor('#CBD5E1').lineWidth(0.75).moveTo(20, tableY).lineTo(399.5, tableY).stroke();
    tableY += 12;

    doc.fillColor('#000000').fontSize(7);
    doc.text('Prepared By (Warehouse):', 25, tableY);
    doc.text(`${dispatch.verifiedBy || 'Warehouse Team'}`, 25, tableY + 10, { bold: true });

    doc.text('Driver Handover Signature:', 155, tableY);
    doc.text('___________________', 155, tableY + 10);

    doc.text('Dealer Received Signature:', 285, tableY);
    doc.text('___________________', 285, tableY + 10);

    doc.end();
  } catch (err) {
    console.error('PDF Generation Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getDispatches = async (req, res) => {
  try {
    const { invoiceNo, dispatchNo, search, status, hasPhoto } = req.query;
    const filter = {};

    if (invoiceNo) {
      filter.salesInvoiceNo = invoiceNo.trim();
    }
    if (dispatchNo) {
      filter.dispatchNo = dispatchNo.trim();
    }
    if (status) {
      filter.status = status;
    }
    if (hasPhoto === 'true') {
      filter.dispatchPhotoUrl = { $nin: ['', null] };
    } else if (hasPhoto === 'false') {
      filter.$or = [{ dispatchPhotoUrl: '' }, { dispatchPhotoUrl: null }, { dispatchPhotoUrl: { $exists: false } }];
    }
    if (search) {
      const reg = new RegExp(search.trim(), 'i');
      filter.$or = [
        { salesInvoiceNo: reg },
        { dispatchNo: reg },
        { vehicleNumber: reg },
        { courierName: reg },
        { driverName: reg },
        { driverMobile: reg }
      ];
    }

    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
    const dispatches = await Dispatch.find(filter).sort({ createdAt: -1 }).limit(limit).populate('dealerId').lean();
    return res.json({ success: true, count: dispatches.length, dispatches });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Module 10B: Live Delivery & Photo Tracking for StaffTrack and External Apps
const trackDeliveryByInvoice = async (req, res) => {
  try {
    const invoiceNo = (req.params.invoiceNo || req.query.invoiceNo || '').trim();
    if (!invoiceNo) {
      return res.status(400).json({ success: false, message: 'invoiceNo parameter is required.' });
    }

    const dispatch = await Dispatch.findOne({ salesInvoiceNo: invoiceNo }).sort({ createdAt: -1 }).populate('dealerId').lean();
    const invoice = await SalesInvoice.findOne({ invoiceNo }).populate('dealerId').lean();

    if (!dispatch && !invoice) {
      return res.status(404).json({
        success: false,
        isSubmitted: false,
        message: `No order or dispatch found for invoice #${invoiceNo}.`
      });
    }

    const photo = dispatch?.dispatchPhotoUrl || invoice?.dispatchPhotoUrl || '';
    const photoTime = dispatch?.dispatchPhotoUploadedAt || invoice?.dispatchPhotoUploadedAt || null;

    if (!dispatch) {
      return res.json({
        success: true,
        isSubmitted: false,
        isPhotoUploaded: Boolean(photo),
        dispatchPhotoUrl: photo || null,
        photoUploadedAt: photoTime,
        status: invoice.status || 'pending',
        orderStatus: invoice.orderStatus || 'new',
        deliveryStatus: 'Pending Dispatch (Not yet submitted)',
        invoiceNo: invoice.invoiceNo,
        dealer: {
          id: invoice.dealerId?._id || invoice.dealerId,
          name: invoice.dealerName,
          garageName: invoice.garageName,
          phone: invoice.dealerPhone,
          address: invoice.dealerAddress
        },
        destination: invoice.destination || 'N/A',
        despatchedThrough: invoice.despatchedThrough || 'N/A',
        totalAmount: invoice.totalAmount,
        totalItems: invoice.items?.length || 0,
        message: `Order #${invoiceNo} is created in warehouse, but QR scan dispatch has not been completed yet.`
      });
    }

    return res.json({
      success: true,
      isSubmitted: true,
      isPhotoUploaded: Boolean(photo),
      dispatchPhotoUrl: photo || null,
      photoUploadedAt: photoTime,
      status: dispatch.status,
      deliveryStatus: dispatch.status === 'completed' ? 'Delivered & Completed' : 'Dispatched / In Transit',
      dispatchId: dispatch._id,
      dispatchNo: dispatch.dispatchNo,
      invoiceNo: dispatch.salesInvoiceNo,
      destination: invoice?.destination || dispatch.dealerId?.city || 'N/A',
      dealer: {
        id: dispatch.dealerId?._id || invoice?.dealerId?._id,
        name: dispatch.dealerId?.dealerName || invoice?.dealerName,
        garageName: dispatch.dealerId?.garageName || invoice?.garageName,
        phone: dispatch.dealerId?.phone || invoice?.dealerPhone,
        address: dispatch.dealerId?.address || invoice?.dealerAddress,
        city: dispatch.dealerId?.city || '',
        state: dispatch.dealerId?.state || ''
      },
      transport: {
        courierName: dispatch.courierName,
        vehicleNumber: dispatch.vehicleNumber,
        driverName: dispatch.driverName,
        driverMobile: dispatch.driverMobile,
        handoverTo: dispatch.handoverTo
      },
      boxes: {
        scannedCount: dispatch.scannedBoxQrIds?.length || 0,
        scannedBoxQrIds: dispatch.scannedBoxQrIds || []
      },
      dispatchDate: dispatch.dispatchDate || dispatch.createdAt,
      expectedDelivery: dispatch.expectedDelivery,
      verifiedBy: dispatch.verifiedBy,
      pdfUrl: `https://warehouse.vanikicrop.com/api/dispatches/${dispatch._id}/pdf`,
      deliveryStatementUrl: `https://warehouse.vanikicrop.com/delivery-statement?dispatchId=${dispatch._id}`
    });
  } catch (err) {
    console.error('Track Delivery Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const approveDispatch = async (req, res) => {
  try {
    const { id } = req.params;
    const dispatch = await Dispatch.findById(id);
    if (!dispatch) return res.status(404).json({ success: false, message: 'Dispatch not found' });

    dispatch.status = 'completed';
    dispatch.approvedBy = req.user?.name || 'Admin';
    dispatch.approvedAt = new Date();
    await dispatch.save();

    await AuditLog.create({
      action: 'DISPATCH_APPROVED',
      user: req.user?.username || 'admin',
      role: 'admin',
      module: 'Dispatch',
      details: `Admin approved Dispatch #${dispatch.dispatchNo}`
    });

    return res.json({ success: true, message: `Dispatch #${dispatch.dispatchNo} approved and completed!`, dispatch });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const cancelDispatch = async (req, res) => {
  try {
    const { id } = req.params;
    const dispatch = await Dispatch.findById(id);
    if (!dispatch) return res.status(404).json({ success: false, message: 'Dispatch not found' });

    dispatch.status = 'cancelled';
    await dispatch.save();

    // Revert boxes to available in one bulk write.
    if (dispatch.scannedBoxQrIds?.length) {
      await StockBox.updateMany(
        { qrId: { $in: dispatch.scannedBoxQrIds } },
        {
          $set: {
            status: 'available',
            assignedInvoiceNo: null,
            assignedDealerId: null,
            dispatchId: null,
            updatedAt: new Date()
          },
          $push: {
            history: {
              stage: 'Dispatch Cancelled',
              title: `Dispatch #${dispatch.dispatchNo} Cancelled`,
              description: 'Restored box to available inventory',
              performedBy: req.user?.name || 'Admin',
              timestamp: new Date()
            }
          }
        }
      );
    }

    await AuditLog.create({
      action: 'DISPATCH_CANCELLED',
      user: req.user?.username || 'admin',
      role: 'admin',
      module: 'Dispatch',
      details: `Admin cancelled Dispatch #${dispatch.dispatchNo}`
    });

    return res.json({ success: true, message: `Dispatch #${dispatch.dispatchNo} cancelled and boxes restored to available inventory.`, dispatch });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  verifyBoxScan,
  confirmDispatch,
  uploadDispatchPhoto,
  downloadDeliveryStatementPdf,
  getDispatches,
  approveDispatch,
  cancelDispatch,
  trackDeliveryByInvoice
};

