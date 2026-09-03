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

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Delivery_Statement_${dispatch.dispatchNo}.pdf"`);

    doc.pipe(res);

    // Color Theme (#0F6E56)
    const primaryColor = '#0F6E56';

    // Header Banner
    doc.rect(40, 40, 515, 65).fill(primaryColor);
    doc.fillColor('#FFFFFF').fontSize(20).text('VANIKI CROP SCIENCE', 55, 52, { bold: true });
    doc.fontSize(11).text('WAREHOUSE DELIVERY STATEMENT & HANDOVER SHEET', 55, 78);

    // Document Metadata Right Box
    doc.fillColor('#000000').fontSize(10);
    doc.text(`Statement No: ${dispatch.dispatchNo}`, 380, 52, { align: 'right' });
    doc.text(`Date: ${new Date(dispatch.dispatchDate).toLocaleDateString()}`, 380, 68, { align: 'right' });
    doc.text(`Invoice No: ${dispatch.salesInvoiceNo}`, 380, 84, { align: 'right' });

    doc.moveDown(3);

    // Company & Dealer Section Grid
    doc.fillColor(primaryColor).fontSize(12).text('DEALER & DELIVERY DETAILS', 40, 125, { bold: true });
    doc.strokeColor(primaryColor).lineWidth(1).moveTo(40, 140).lineTo(555, 140).stroke();

    doc.fillColor('#333333').fontSize(9);
    doc.text(`Dealer Name: ${dispatch.dealerId?.dealerName || 'N/A'}`, 40, 150);
    doc.text(`Garage Name: ${dispatch.dealerId?.garageName || 'N/A'}`, 40, 165);
    doc.text(`GST Number: ${dispatch.dealerId?.gstNumber || 'N/A'}`, 40, 180);
    doc.text(`Contact Phone: ${dispatch.dealerId?.phone || 'N/A'}`, 40, 195);
    doc.text(`Address: ${dispatch.dealerId?.address}, ${dispatch.dealerId?.city}, ${dispatch.dealerId?.state} - ${dispatch.dealerId?.pincode}`, 40, 210);

    // Transport Details Box
    doc.fillColor(primaryColor).fontSize(12).text('COURIER & LOGISTICS', 320, 125, { bold: true });
    doc.fillColor('#333333').fontSize(9);
    doc.text(`Courier Service: ${dispatch.courierName}`, 320, 150);
    doc.text(`Vehicle Number: ${dispatch.vehicleNumber}`, 320, 165);
    doc.text(`Driver Name: ${dispatch.driverName}`, 320, 180);
    doc.text(`Driver Phone: ${dispatch.driverMobile}`, 320, 195);
    doc.text(`Handover To: ${dispatch.handoverTo}`, 320, 210);

    doc.moveDown(6);

    // Scanned QR Box Items Table with Quantity Column
    doc.fillColor(primaryColor).fontSize(11).text(`VERIFIED DISPATCHED PRODUCTS SUMMARY (${dispatch.scannedBoxQrIds?.length || 0} TOTAL BOXES)`, 40, 245, { bold: true });
    doc.strokeColor(primaryColor).lineWidth(1).moveTo(40, 258).lineTo(555, 258).stroke();

    let y = 268;
    doc.fillColor('#1E293B').fontSize(8.5);
    doc.text('S.No', 42, y, { bold: true });
    doc.text('Product Name & Composition', 72, y, { bold: true, width: 160 });
    doc.text('Batch No.', 235, y, { bold: true, width: 75 });
    doc.text('Packing', 315, y, { bold: true, width: 55 });
    doc.text('Qty (Boxes)', 375, y, { bold: true, width: 65, align: 'center' });
    doc.text('Verified QR IDs Range', 445, y, { bold: true, width: 110 });

    y += 14;
    doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(40, y).lineTo(555, y).stroke();
    y += 6;

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
      if (y > 670) {
        doc.addPage();
        y = 50;
      }

      const qrSummary = item.qrIds.length > 2 
        ? `${item.qrIds[0]} ... ${item.qrIds[item.qrIds.length - 1]} (${item.qrIds.length})` 
        : item.qrIds.join(', ');

      doc.fillColor('#1E293B').fontSize(8.5);
      doc.text(`${idx + 1}`, 42, y);

      // Product + Technical Name
      let pDisplay = item.productName;
      if (item.technicalName) {
        pDisplay += `\n(${item.technicalName})`;
      }
      doc.text(pDisplay, 72, y, { width: 155 });
      doc.text(item.batchNumber, 235, y, { width: 75 });
      doc.text(item.packing, 315, y, { width: 55 });

      // Quantity (Boxes) in bold highlight
      doc.fillColor(primaryColor).text(`${item.quantity} Boxes`, 375, y, { bold: true, width: 65, align: 'center' });

      // QR summary
      doc.fillColor('#475569').text(qrSummary, 445, y, { width: 110 });

      const rowHeight = item.technicalName ? 26 : 18;
      y += rowHeight;
      doc.strokeColor('#F1F5F9').lineWidth(0.5).moveTo(40, y).lineTo(555, y).stroke();
      y += 4;
    });

    // Total summary bar
    y += 6;
    doc.rect(40, y, 515, 20).fill('#F8FAFC');
    doc.fillColor(primaryColor).fontSize(9).text(`TOTAL DISPATCHED: ${dispatch.scannedBoxQrIds?.length || 0} VERIFIED BOXES`, 48, y + 5, { bold: true });
    y += 26;

    // Signatures Section
    y = Math.max(y + 40, 680);
    doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
    y += 30;

    doc.fillColor('#000000').fontSize(9);
    doc.text('Prepared By:', 50, y);
    doc.text(`${dispatch.verifiedBy}`, 50, y + 15, { bold: true });

    doc.text('Driver Signature:', 240, y);
    doc.text('__________________', 240, y + 15);

    doc.text('Dealer Receiver Signature:', 420, y);
    doc.text('__________________', 420, y + 15);

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

