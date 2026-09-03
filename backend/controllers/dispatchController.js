const Dispatch = require('../models/Dispatch');
const StockBox = require('../models/StockBox');
const SalesInvoice = require('../models/SalesInvoice');
const Dealer = require('../models/Dealer');
const AuditLog = require('../models/AuditLog');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

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
      $or: [{ qrId: cleanQrId }, { barcode: cleanQrId }]
    });

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
        title: '✓ STOCK VERIFIED',
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

    // 4. Validate Product & Strict Batch Number Match against invoice items
    const norm = (s) => (s || '').toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    const matchingProductItems = invoice.items.filter(item => {
      const lineName = norm(item.productName);
      const boxName = norm(box.productName);
      const pNameMatch = lineName === boxName || (lineName && boxName && (lineName.includes(boxName) || boxName.includes(lineName)));
      const pCodeMatch = item.productCode && box.productCode && norm(item.productCode) === norm(box.productCode);
      return pNameMatch || pCodeMatch;
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

    // Strict Batch Number Matching
    const matchingItem = matchingProductItems.find(item => {
      if (!item.batchNumber || !item.batchNumber.trim() || item.batchNumber.trim().toUpperCase() === 'ANY') {
        return true;
      }
      const itemBatch = norm(item.batchNumber);
      const boxBatch = norm(box.batchNumber);
      return itemBatch === boxBatch;
    });

    if (!matchingItem) {
      const expectedBatches = matchingProductItems.map(i => i.batchNumber).filter(Boolean).join(', ') || 'N/A';
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

    // 5. If Product & Batch match -> GREEN SCREEN (Verified)
    return res.json({
      success: true,
      verified: true,
      code: 'VERIFIED_READY',
      title: '✓ VERIFIED - BATCH MATCH',
      reason: `Box ${box.qrId} (${box.productName} | Batch: ${box.batchNumber || 'N/A'}) matches Invoice #${salesInvoiceNo} for dealer ${invoice.dealerName || 'Dealer'}.`,
      box: {
        id: box._id,
        qrId: box.qrId,
        productName: box.productName,
        batchNumber: box.batchNumber,
        weight: box.weight,
        warehouseLocation: box.warehouseLocation
      },
      matchedItem: {
        productName: matchingItem.productName,
        batchNumber: matchingItem.batchNumber,
        orderedQuantity: matchingItem.quantity || 1,
        weight: matchingItem.weight || box.weight
      },
      invoice: {
        invoiceNo: invoice.invoiceNo,
        dealerName: invoice.dealerName,
        garageName: invoice.garageName,
        items: invoice.items
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
    const invoice = await SalesInvoice.findOne({ invoiceNo: cleanInvoiceNo }).populate('dealerId');
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

    // Update status of all scanned boxes & append lifecycle history
    for (const qrId of scannedQrIds) {
      const box = await StockBox.findOne({ qrId });
      if (box) {
        box.status = 'dispatched';
        box.assignedInvoiceNo = cleanInvoiceNo;
        box.assignedDealerId = dealerId || invoice?.dealerId?._id || null;
        box.dispatchId = dispatch._id;
        
        const dName = invoice?.dealerName || 'Valued Dealer';
        const gName = invoice?.garageName || 'Branch';

        box.history.push({
          stage: 'Invoice Assigned',
          title: `Assigned to Invoice #${cleanInvoiceNo}`,
          description: `Dealer: ${dName} (${gName})`,
          performedBy: req.user?.name || 'Warehouse Operator',
          timestamp: new Date()
        });
        box.history.push({
          stage: 'Verified',
          title: 'QR Scan Verified',
          description: 'Checked before dispatch - All details match',
          performedBy: req.user?.name || 'Warehouse Operator',
          timestamp: new Date()
        });
        box.history.push({
          stage: 'Dispatched',
          title: `Dispatched via ${courierName || 'Courier'}`,
          description: `Vehicle: ${vehicleNumber || 'N/A'}, Driver: ${driverName || 'N/A'} (${driverMobile || 'N/A'})`,
          performedBy: req.user?.name || 'Warehouse Operator',
          timestamp: new Date()
        });
        if (dispatchPhotoUrl) {
          box.history.push({
            stage: 'Goods Photo Captured',
            title: 'Dispatched Goods Photo Stored',
            description: 'Physical proof of loaded products stored during handover',
            performedBy: req.user?.name || 'Warehouse Operator',
            timestamp: new Date()
          });
        }
        box.history.push({
          stage: 'Delivered',
          title: 'Handed to Delivery Agent',
          description: `Dispatched for delivery to ${dName}`,
          performedBy: req.user?.name || 'Warehouse Operator',
          timestamp: new Date()
        });
        await box.save();
      }
    }

    // Update invoice status if invoice exists
    if (invoice) {
      invoice.status = 'dispatched';
      invoice.scannedCount = scannedQrIds.length;
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
      message: `Dispatch #${dispatchNo} completed successfully! ${scannedQrIds.length} boxes updated to Dispatched.`,
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

    const boxes = await StockBox.find({ qrId: { $in: dispatch.scannedBoxQrIds || [] } });

    // Group boxes by Product + Batch
    const groupMap = new Map();
    boxes.forEach(box => {
      const key = `${box.productName || 'General Product'}___${box.batchNumber || 'N/A'}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          productName: box.productName || 'General Product',
          technicalName: box.technicalName || '',
          batchNumber: box.batchNumber || 'N/A',
          packing: box.packing || box.weight || box.packingSize || '1 kg',
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
    const dispatches = await Dispatch.find().sort({ createdAt: -1 }).populate('dealerId');
    return res.json({ success: true, dispatches });
  } catch (err) {
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

    // Revert box status to available
    for (const qrId of dispatch.scannedBoxQrIds) {
      const box = await StockBox.findOne({ qrId });
      if (box) {
        box.status = 'available';
        box.assignedInvoiceNo = null;
        box.assignedDealerId = null;
        box.dispatchId = null;
        box.history.push({
          stage: 'Dispatch Cancelled',
          title: `Dispatch #${dispatch.dispatchNo} Cancelled`,
          description: 'Restored box to available inventory',
          performedBy: req.user?.name || 'Admin',
          timestamp: new Date()
        });
        await box.save();
      }
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

module.exports = { verifyBoxScan, confirmDispatch, uploadDispatchPhoto, downloadDeliveryStatementPdf, getDispatches, approveDispatch, cancelDispatch };

